import Darwin
import Foundation
import FoundationModels

struct HostCase: Decodable {
  let id: String
  let systemPrompt: String
  let question: String
  let approvedDocument: String
}

struct RunnerRecord: Encodable {
  let type: String
  let availability: String
  let availabilityReason: String?
  let localeSupported: Bool
  let contextSize: Int?
  let modelIdentity: String
  let device: String
  let osVersion: String
  let osBuild: String
  let durationMs: Double?
  let caseId: String?
  let status: String?
  let text: String?
  let error: String?
  let firstTokenTimeMs: Double?
  let totalTimeMs: Double?
  let outputLength: Int?
}

func commandOutput(_ executable: String, _ arguments: [String]) -> String {
  let process = Process()
  let pipe = Pipe()
  process.executableURL = URL(fileURLWithPath: executable)
  process.arguments = arguments
  process.standardOutput = pipe
  process.standardError = Pipe()
  do {
    try process.run()
    process.waitUntilExit()
    guard process.terminationStatus == 0 else { return "unknown" }
    let data = pipe.fileHandleForReading.readDataToEndOfFile()
    return String(decoding: data, as: UTF8.self)
      .trimmingCharacters(in: .whitespacesAndNewlines)
  } catch {
    return "unknown"
  }
}

func hardwareModel() -> String {
  var size = 0
  guard sysctlbyname("hw.model", nil, &size, nil, 0) == 0, size > 0 else { return "Mac" }
  var value = [CChar](repeating: 0, count: size)
  guard sysctlbyname("hw.model", &value, &size, nil, 0) == 0 else { return "Mac" }
  return String(cString: value)
}

func write(_ record: RunnerRecord) {
  let encoder = JSONEncoder()
  encoder.outputFormatting = [.sortedKeys]
  guard let data = try? encoder.encode(record) else {
    FileHandle.standardError.write(Data("apple_host_runner_encode_failed\n".utf8))
    return
  }
  FileHandle.standardOutput.write(data)
  FileHandle.standardOutput.write(Data("\n".utf8))
}

@available(macOS 26.0, *)
func availabilityReason(
  _ reason: SystemLanguageModel.Availability.UnavailableReason
) -> String {
  switch reason {
  case .deviceNotEligible:
    return "deviceNotEligible"
  case .appleIntelligenceNotEnabled:
    return "appleIntelligenceNotEnabled"
  case .modelNotReady:
    return "modelNotReady"
  @unknown default:
    return "modelNotReady"
  }
}

@available(macOS 26.0, *)
func generationErrorCode(_ error: LanguageModelSession.GenerationError) -> String {
  switch error {
  case .exceededContextWindowSize:
    return "context_exceeded"
  case .unsupportedLanguageOrLocale:
    return "unsupported_locale"
  case .concurrentRequests:
    return "busy"
  case .rateLimited:
    return "quota_exceeded"
  default:
    return "generation_failed"
  }
}

@available(macOS 26.0, *)
func baseRecord(type: String, started: Date) -> RunnerRecord {
  let model = SystemLanguageModel.default
  let state: String
  let reason: String?
  switch model.availability {
  case .available:
    state = "available"
    reason = nil
  case .unavailable(let unavailableReason):
    state = "unavailable"
    reason = availabilityReason(unavailableReason)
  }
  let version = commandOutput("/usr/bin/sw_vers", ["-productVersion"])
  return RunnerRecord(
    type: type,
    availability: state,
    availabilityReason: reason,
    localeSupported: model.supportsLocale(Locale.current),
    contextSize: model.contextSize,
    modelIdentity: "apple-system-model/macOS-\(version)",
    device: hardwareModel(),
    osVersion: version,
    osBuild: commandOutput("/usr/bin/sw_vers", ["-buildVersion"]),
    durationMs: Date().timeIntervalSince(started) * 1_000,
    caseId: nil,
    status: nil,
    text: nil,
    error: nil,
    firstTokenTimeMs: nil,
    totalTimeMs: nil,
    outputLength: nil
  )
}

@available(macOS 26.0, *)
func runCase(_ item: HostCase) async -> RunnerRecord {
  let facts = baseRecord(type: "case", started: Date())
  let started = Date()
  var firstTokenTimeMs: Double?
  var completeText = ""
  do {
    let session = LanguageModelSession(
      model: SystemLanguageModel.default,
      instructions: item.systemPrompt
    )
    let prompt = "Question: \(item.question)\n\nApproved document:\n\(item.approvedDocument)"
    for try await snapshot in session.streamResponse(to: prompt) {
      let nextText = snapshot.content
      if firstTokenTimeMs == nil && !nextText.isEmpty {
        firstTokenTimeMs = Date().timeIntervalSince(started) * 1_000
      }
      completeText = nextText
    }
    let totalTimeMs = Date().timeIntervalSince(started) * 1_000
    return RunnerRecord(
      type: "case",
      availability: facts.availability,
      availabilityReason: facts.availabilityReason,
      localeSupported: facts.localeSupported,
      contextSize: facts.contextSize,
      modelIdentity: facts.modelIdentity,
      device: facts.device,
      osVersion: facts.osVersion,
      osBuild: facts.osBuild,
      durationMs: nil,
      caseId: item.id,
      status: "passed",
      text: completeText,
      error: nil,
      firstTokenTimeMs: firstTokenTimeMs,
      totalTimeMs: totalTimeMs,
      outputLength: completeText.count
    )
  } catch let error as LanguageModelSession.GenerationError {
    return failedCase(item, facts: facts, started: started, error: generationErrorCode(error))
  } catch {
    return failedCase(item, facts: facts, started: started, error: "generation_failed")
  }
}

func failedCase(
  _ item: HostCase,
  facts: RunnerRecord,
  started: Date,
  error: String
) -> RunnerRecord {
  RunnerRecord(
    type: "case",
    availability: facts.availability,
    availabilityReason: facts.availabilityReason,
    localeSupported: facts.localeSupported,
    contextSize: facts.contextSize,
    modelIdentity: facts.modelIdentity,
    device: facts.device,
    osVersion: facts.osVersion,
    osBuild: facts.osBuild,
    durationMs: nil,
    caseId: item.id,
    status: "failed",
    text: nil,
    error: error,
    firstTokenTimeMs: nil,
    totalTimeMs: Date().timeIntervalSince(started) * 1_000,
    outputLength: 0
  )
}

@available(macOS 26.0, *)
func run() async -> Int32 {
  let started = Date()
  let probe = baseRecord(type: "probe", started: started)
  let probeOnly = CommandLine.arguments.contains("--probe")
  if probeOnly || probe.availability != "available" || !probe.localeSupported {
    write(probe)
    return probeOnly ? 0 : 2
  }

  let decoder = JSONDecoder()
  while let line = readLine() {
    guard let data = line.data(using: .utf8), let item = try? decoder.decode(HostCase.self, from: data)
    else {
      FileHandle.standardError.write(Data("apple_host_case_invalid\n".utf8))
      return 3
    }
    write(await runCase(item))
  }
  return 0
}

Task {
  guard #available(macOS 26.0, *) else {
    FileHandle.standardError.write(Data("apple_host_unsupported_os\n".utf8))
    exit(4)
  }
  exit(await run())
}
RunLoop.main.run()
