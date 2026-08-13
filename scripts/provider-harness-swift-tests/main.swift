import Foundation

private func require(_ condition: @autoclosure () -> Bool, _ message: String) {
  guard condition() else {
    FileHandle.standardError.write(Data("Provider harness test failed: \(message)\n".utf8))
    exit(1)
  }
}

guard CommandLine.arguments.count == 2 else {
  FileHandle.standardError.write(Data("Usage: provider-harness-swift-tests <manifest>\n".utf8))
  exit(2)
}

do {
  let data = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
  let ios = try ProviderHarness.load(data: data, scenarioName: " available ", platform: "ios")
  let android = try ProviderHarness.load(data: data, scenarioName: "available", platform: "android")
  let downloadable = try ProviderHarness.load(
    data: data,
    scenarioName: "downloadable",
    platform: "android"
  )

  require(ios.id == "available", "trimmed iOS scenario name")
  require(ios.capability.state == "available", "iOS availability")
  require(ios.generation.tokens.count == 2, "iOS fixed tokens")
  require(android.capability.state == "AVAILABLE", "Android availability")
  require(downloadable.downloadProgress == [0, 0.25, 0.75, 1], "Android download progress")

  do {
    _ = try ProviderHarness.load(data: data, scenarioName: "downloadable", platform: "ios")
    require(false, "downloadable must not load on iOS")
  } catch ProviderHarnessError.unsupportedPlatform {
    // Expected.
  }

  do {
    _ = try ProviderHarness.load(data: data, scenarioName: "missing", platform: "ios")
    require(false, "unknown scenario must fail")
  } catch ProviderHarnessError.unknownScenario {
    // Expected.
  }

  let manifest = try JSONDecoder().decode(ProviderHarnessManifest.self, from: data)
  for scenario in manifest.scenarios {
    for capability in scenario.capabilities.values {
      if let identity = capability.modelIdentity {
        require(identity.hasPrefix("simulated/"), "simulated model identity prefix")
      }
    }
  }

  print("Validated \(manifest.scenarios.count) Swift provider scenarios.")
} catch {
  FileHandle.standardError.write(Data("Provider harness test failed: \(error)\n".utf8))
  exit(1)
}
