import Foundation

enum ProviderHarnessError: Error {
  case manifestMissing
  case scenarioArgumentMissing
  case unknownScenario
  case unsupportedPlatform
}

struct ProviderHarnessManifest: Decodable {
  let schemaVersion: Int
  let scenarios: [ProviderHarnessScenario]
}

struct ProviderHarnessScenario: Decodable {
  let id: String
  let platforms: [String]
  let capabilities: [String: ProviderHarnessCapability]
  let generation: ProviderHarnessGeneration
  let downloadProgress: [Double]?
}

struct ProviderHarnessCapability: Decodable {
  let state: String
  let contextSize: Int?
  let modelIdentity: String?
  let reason: String?
}

struct ProviderHarnessGeneration: Decodable {
  let tokens: [String]?
  let text: String?
  let error: String?
}

struct ProviderHarnessResolvedScenario {
  let id: String
  let capability: ProviderHarnessCapability
  let generation: ProviderHarnessResolvedGeneration
  let downloadProgress: [Double]
}

struct ProviderHarnessResolvedGeneration {
  let tokens: [String]
  let text: String?
  let error: String?
}

enum ProviderHarness {
  static let argumentName = "-AirgapProviderScenario"

  static func requestedScenarioName(arguments: [String] = CommandLine.arguments) -> String? {
    guard
      let argumentIndex = arguments.firstIndex(of: argumentName),
      arguments.indices.contains(argumentIndex + 1)
    else {
      return nil
    }
    let name = arguments[argumentIndex + 1].trimmingCharacters(in: .whitespacesAndNewlines)
    return name.isEmpty ? nil : name
  }

  static func load(
    bundle: Bundle = .main,
    arguments: [String] = CommandLine.arguments
  ) throws -> ProviderHarnessResolvedScenario {
    guard let scenarioName = requestedScenarioName(arguments: arguments) else {
      throw ProviderHarnessError.scenarioArgumentMissing
    }
    guard let url = bundle.url(forResource: "provider-scenarios", withExtension: "json") else {
      throw ProviderHarnessError.manifestMissing
    }

    return try load(
      data: Data(contentsOf: url),
      scenarioName: scenarioName,
      platform: "ios"
    )
  }

  static func load(
    data: Data,
    scenarioName: String,
    platform: String
  ) throws -> ProviderHarnessResolvedScenario {
    let manifest = try JSONDecoder().decode(ProviderHarnessManifest.self, from: data)
    let normalizedName = scenarioName.trimmingCharacters(in: .whitespacesAndNewlines)
    let normalizedPlatform = platform.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

    guard let scenario = manifest.scenarios.first(where: { $0.id == normalizedName }) else {
      throw ProviderHarnessError.unknownScenario
    }
    guard
      scenario.platforms.contains(normalizedPlatform),
      let capability = scenario.capabilities[normalizedPlatform]
    else {
      throw ProviderHarnessError.unsupportedPlatform
    }

    return ProviderHarnessResolvedScenario(
      id: scenario.id,
      capability: capability,
      generation: ProviderHarnessResolvedGeneration(
        tokens: scenario.generation.tokens ?? [],
        text: scenario.generation.text,
        error: scenario.generation.error
      ),
      downloadProgress: scenario.downloadProgress ?? []
    )
  }
}
