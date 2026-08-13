import Foundation
import React
import UIKit

#if canImport(FoundationModels)
import FoundationModels
#endif

@objc(AppleFoundationModelsModule)
final class AppleFoundationModelsModule: RCTEventEmitter {
  private var activeTasks: [String: Task<Void, Never>] = [:]
  private let taskLock = NSLock()

  override static func requiresMainQueueSetup() -> Bool {
    false
  }

  override func supportedEvents() -> [String]! {
    ["AirgapInferenceToken"]
  }

  @objc(getCapabilities:rejecter:)
  func getCapabilities(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    #if canImport(FoundationModels)
    if #available(iOS 26.0, *) {
      let model = SystemLanguageModel.default
      let base: [String: Any] = [
        "contextSize": model.contextSize,
        "modelIdentity": modelIdentity(),
        "osVersion": UIDevice.current.systemVersion,
        "localeSupported": model.supportsLocale(Locale.current),
      ]
      switch model.availability {
      case .available:
        if model.supportsLocale(Locale.current) {
          resolve(base.merging(["state": "available"]) { _, new in new })
        } else {
          resolve(base.merging([
            "state": "unavailable",
            "reason": "unsupportedLocale",
          ]) { _, new in new })
        }
      case .unavailable(let reason):
        resolve(base.merging([
          "state": "unavailable",
          "reason": availabilityReason(reason),
        ]) { _, new in new })
      }
      return
    }
    #endif
    resolve([
      "state": "unavailable",
      "reason": "unsupportedOs",
      "osVersion": UIDevice.current.systemVersion,
    ])
  }

  @objc(generate:resolver:rejecter:)
  func generate(
    _ request: [String: Any],
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard
      let requestId = request["requestId"] as? String,
      let systemPrompt = request["systemPrompt"] as? String,
      let userMessage = request["userMessage"] as? String
    else {
      reject("generation_failed", "The inference request is incomplete", nil)
      return
    }

    #if canImport(FoundationModels)
    if #available(iOS 26.0, *) {
      let task = Task { [weak self] in
        guard let self else { return }
        do {
          let model = SystemLanguageModel.default
          guard case .available = model.availability else {
            reject("model_not_ready", "The Apple system model is not ready", nil)
            self.removeTask(requestId)
            return
          }
          guard model.supportsLocale(Locale.current) else {
            reject("unsupported_locale", "The Apple system model does not support this locale", nil)
            self.removeTask(requestId)
            return
          }

          let session = LanguageModelSession(model: model, instructions: systemPrompt)
          var completeText = ""
          for try await snapshot in session.streamResponse(to: userMessage) {
            try Task.checkCancellation()
            let nextText = snapshot.content
            let delta = nextText.hasPrefix(completeText)
              ? String(nextText.dropFirst(completeText.count))
              : nextText
            completeText = nextText
            if !delta.isEmpty {
              self.sendEvent(
                withName: "AirgapInferenceToken",
                body: ["requestId": requestId, "token": delta]
              )
            }
          }
          resolve(["text": completeText, "modelIdentity": self.modelIdentity()])
        } catch is CancellationError {
          reject("cancelled", "The inference request was cancelled", nil)
        } catch let error as LanguageModelSession.GenerationError {
          let code = self.generationErrorCode(error)
          reject(code, error.localizedDescription, error)
        } catch {
          reject("generation_failed", error.localizedDescription, error)
        }
        self.removeTask(requestId)
      }
      storeTask(task, requestId: requestId)
      return
    }
    #endif
    reject("unsupported_os", "Apple Foundation Models requires iOS 26 or newer", nil)
  }

  @objc(cancel:resolver:rejecter:)
  func cancel(
    _ requestId: String,
    resolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    taskLock.lock()
    let task = activeTasks.removeValue(forKey: requestId)
    taskLock.unlock()
    task?.cancel()
    resolve(task != nil)
  }

  private func storeTask(_ task: Task<Void, Never>, requestId: String) {
    taskLock.lock()
    activeTasks[requestId]?.cancel()
    activeTasks[requestId] = task
    taskLock.unlock()
  }

  private func removeTask(_ requestId: String) {
    taskLock.lock()
    activeTasks.removeValue(forKey: requestId)
    taskLock.unlock()
  }

  private func modelIdentity() -> String {
    "apple-system-model/iOS-\(UIDevice.current.systemVersion)"
  }

  #if canImport(FoundationModels)
  @available(iOS 26.0, *)
  private func availabilityReason(
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

  @available(iOS 26.0, *)
  private func generationErrorCode(_ error: LanguageModelSession.GenerationError) -> String {
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
  #endif
}
