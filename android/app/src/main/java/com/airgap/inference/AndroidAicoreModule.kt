package com.airgap.inference

import android.os.Build
import com.airgap.BuildConfig
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.mlkit.genai.common.DownloadStatus
import com.google.mlkit.genai.common.FeatureStatus
import com.google.mlkit.genai.common.GenAiException
import com.google.mlkit.genai.prompt.Generation
import com.google.mlkit.genai.prompt.TextPart
import com.google.mlkit.genai.prompt.generateContentRequest
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class AndroidAicoreModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
  private val activeJobs = ConcurrentHashMap<String, Job>()
  private val modelDelegate = lazy(LazyThreadSafetyMode.SYNCHRONIZED) { Generation.getClient() }
  private val model by modelDelegate

  override fun getName(): String = "AndroidAicoreModule"

  override fun getConstants(): MutableMap<String, Any> {
    val scenarioName = harnessScenarioName()
    return if (scenarioName == null) mutableMapOf() else mutableMapOf("harnessScenario" to scenarioName)
  }

  @ReactMethod
  fun getCapabilities(promise: Promise) {
    val harness = loadHarnessScenario(promise) ?: if (harnessScenarioName() != null) return else null
    if (harness != null) {
      promise.resolve(
        Arguments.createMap().apply {
          putString("state", harness.capability.state)
          putString("osVersion", Build.VERSION.SDK_INT.toString())
          harness.capability.contextSize?.let { putInt("contextSize", it) }
          harness.capability.modelIdentity?.let { putString("modelIdentity", it) }
          harness.capability.reason?.let { putString("reason", it) }
        },
      )
      return
    }
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      promise.resolve(
        Arguments.createMap().apply {
          putString("state", "UNSUPPORTED_OS")
          putString("osVersion", Build.VERSION.SDK_INT.toString())
        },
      )
      return
    }

    scope.launch {
      try {
        val status = model.checkStatus()
        val result =
          Arguments.createMap().apply {
            putString("state", featureStatusName(status))
            putString("osVersion", Build.VERSION.SDK_INT.toString())
            if (status == FeatureStatus.AVAILABLE) {
              putInt("contextSize", minOf(model.getTokenLimit(), MAX_INPUT_TOKENS))
              putString("modelIdentity", "${model.getBaseModelName()}/aicore")
            }
          }
        promise.resolve(result)
      } catch (error: Throwable) {
        reject(error, promise)
      }
    }
  }

  @ReactMethod
  fun download(requestId: String, promise: Promise) {
    val harness = loadHarnessScenario(promise) ?: if (harnessScenarioName() != null) return else null
    if (harness != null) {
      val job = scope.launch {
        try {
          harness.downloadProgress.forEach { progress ->
            emitDownload(requestId, (progress * 100).toLong(), 100)
            delay(10)
          }
          promise.resolve(true)
        } catch (error: Throwable) {
          reject(error, promise)
        } finally {
          activeJobs.remove(requestId)
        }
      }
      replaceJob(requestId, job)
      return
    }
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      promise.reject("unsupported_os", "Android system AI requires API 26 or newer")
      return
    }

    val job =
      scope.launch {
        var totalBytes: Long? = null
        try {
          model.download().collect { status ->
            when (status) {
              is DownloadStatus.DownloadStarted -> {
                totalBytes = status.bytesToDownload
                emitDownload(requestId, 0, totalBytes)
              }
              is DownloadStatus.DownloadProgress -> {
                emitDownload(requestId, status.totalBytesDownloaded, totalBytes)
              }
              DownloadStatus.DownloadCompleted -> Unit
              is DownloadStatus.DownloadFailed -> throw status.e
            }
          }
          promise.resolve(true)
        } catch (error: Throwable) {
          reject(error, promise)
        } finally {
          activeJobs.remove(requestId)
        }
      }
    replaceJob(requestId, job)
  }

  @ReactMethod
  fun warmup(promise: Promise) {
    val harness = loadHarnessScenario(promise) ?: if (harnessScenarioName() != null) return else null
    if (harness != null) {
      promise.resolve(true)
      return
    }
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      promise.reject("unsupported_os", "Android system AI requires API 26 or newer")
      return
    }
    scope.launch {
      try {
        model.warmup()
        promise.resolve(true)
      } catch (error: Throwable) {
        reject(error, promise)
      }
    }
  }

  @ReactMethod
  fun generate(request: ReadableRequest, promise: Promise) {
    generate(request.toMap(), promise)
  }

  private fun generate(request: Map<String, Any?>, promise: Promise) {
    val requestId = request["requestId"] as? String
    val systemPrompt = request["systemPrompt"] as? String
    val userMessage = request["userMessage"] as? String
    if (requestId == null || systemPrompt == null || userMessage == null) {
      promise.reject("generation_failed", "The inference request is incomplete")
      return
    }
    val harness = loadHarnessScenario(promise) ?: if (harnessScenarioName() != null) return else null
    if (harness != null) {
      runHarnessGeneration(harness, requestId, promise)
      return
    }
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      promise.reject("unsupported_os", "Android system AI requires API 26 or newer")
      return
    }

    val job =
      scope.launch {
        try {
          val input = generateContentRequest(TextPart(groundedPrompt(systemPrompt, userMessage))) {
            temperature = 0.2f
            candidateCount = 1
            maxOutputTokens = DEFAULT_OUTPUT_TOKENS
          }
          val inputTokens = model.countTokens(input).totalTokens
          val tokenLimit = model.getTokenLimit()
          if (
            inputTokens >= MAX_INPUT_TOKENS ||
              inputTokens + MIN_OUTPUT_TOKENS > tokenLimit
          ) {
            promise.reject(
              "context_exceeded",
              "The approved document context is too large for Android system AI",
            )
            return@launch
          }

          val outputTokens = minOf(DEFAULT_OUTPUT_TOKENS, tokenLimit - inputTokens)
          val boundedRequest = generateContentRequest(
            TextPart(groundedPrompt(systemPrompt, userMessage)),
          ) {
            temperature = 0.2f
            candidateCount = 1
            maxOutputTokens = outputTokens
          }
          val fullResponse = StringBuilder()
          model.generateContentStream(boundedRequest).collect { chunk ->
            val text = chunk.candidates.firstOrNull()?.text.orEmpty()
            if (text.isNotEmpty()) {
              fullResponse.append(text)
              emitToken(requestId, text)
            }
          }
          promise.resolve(
            Arguments.createMap().apply {
              putString("text", fullResponse.toString())
              putString("modelIdentity", "${model.getBaseModelName()}/aicore")
            },
          )
        } catch (error: Throwable) {
          reject(error, promise)
        } finally {
          activeJobs.remove(requestId)
        }
      }
    replaceJob(requestId, job)
  }

  @ReactMethod
  fun cancel(requestId: String, promise: Promise) {
    val job = activeJobs.remove(requestId)
    job?.cancel()
    promise.resolve(job != null)
  }

  @ReactMethod
  fun addListener(eventName: String) = Unit

  @ReactMethod
  fun removeListeners(count: Double) = Unit

  override fun invalidate() {
    activeJobs.values.forEach(Job::cancel)
    activeJobs.clear()
    scope.cancel()
    if (modelDelegate.isInitialized()) model.close()
    super.invalidate()
  }

  private fun replaceJob(requestId: String, job: Job) {
    activeJobs.put(requestId, job)?.cancel()
  }

  private fun harnessScenarioName(): String? {
    if (!BuildConfig.DEBUG) return null
    return reactApplicationContext.currentActivity
      ?.intent
      ?.getStringExtra(HARNESS_SCENARIO_EXTRA)
      ?.trim()
      ?.takeIf(String::isNotEmpty)
  }

  private fun loadHarnessScenario(promise: Promise): ProviderHarnessResolvedScenario? {
    val scenarioName = harnessScenarioName() ?: return null
    return try {
      val manifest = reactApplicationContext.assets
        .open("provider-scenarios.json")
        .bufferedReader()
        .use { it.readText() }
      ProviderHarness.load(manifest, scenarioName)
    } catch (error: Throwable) {
      promise.reject(
        "generation_failed",
        "The provider harness scenario could not be loaded",
        error,
      )
      null
    }
  }

  private fun runHarnessGeneration(
    scenario: ProviderHarnessResolvedScenario,
    requestId: String,
    promise: Promise,
  ) {
    val job = scope.launch {
      try {
        scenario.generation.error?.let { errorCode ->
          promise.reject(errorCode, "Provider harness scenario: $errorCode")
          return@launch
        }
        scenario.generation.tokens.forEach { token ->
          emitToken(requestId, token)
          delay(10)
        }
        promise.resolve(
          Arguments.createMap().apply {
            putString(
              "text",
              scenario.generation.text ?: scenario.generation.tokens.joinToString(""),
            )
            putString(
              "modelIdentity",
              scenario.capability.modelIdentity ?: "simulated/google-gemini-nano",
            )
          },
        )
      } catch (error: Throwable) {
        reject(error, promise)
      } finally {
        activeJobs.remove(requestId)
      }
    }
    replaceJob(requestId, job)
  }

  private fun emitToken(requestId: String, token: String) {
    emit(
      "AirgapInferenceToken",
      Arguments.createMap().apply {
        putString("requestId", requestId)
        putString("token", token)
      },
    )
  }

  private fun emitDownload(requestId: String, bytesDownloaded: Long, totalBytes: Long?) {
    emit(
      "AirgapInferenceDownload",
      Arguments.createMap().apply {
        putString("requestId", requestId)
        putDouble("bytesDownloaded", bytesDownloaded.toDouble())
        totalBytes?.let { putDouble("totalBytes", it.toDouble()) }
      },
    )
  }

  private fun emit(name: String, body: Any) {
    reactApplicationContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(name, body)
  }

  private fun featureStatusName(status: Int): String =
    when (status) {
      FeatureStatus.AVAILABLE -> "AVAILABLE"
      FeatureStatus.DOWNLOADABLE -> "DOWNLOADABLE"
      FeatureStatus.DOWNLOADING -> "DOWNLOADING"
      else -> "UNAVAILABLE"
    }

  private fun reject(error: Throwable, promise: Promise) {
    if (error is CancellationException) {
      promise.reject("cancelled", "The inference request was cancelled", error)
      return
    }
    if (error is GenAiException) {
      promise.reject(errorCode(error), error.message ?: "Android system AI failed", error)
      return
    }
    promise.reject("generation_failed", error.message ?: "Android system AI failed", error)
  }

  private fun errorCode(error: GenAiException): String =
    when (error.errorCode) {
      GenAiException.ErrorCode.CANCELLED -> "cancelled"
      GenAiException.ErrorCode.BACKGROUND_USE_BLOCKED -> "background_blocked"
      GenAiException.ErrorCode.PER_APP_BATTERY_USE_QUOTA_EXCEEDED -> "quota_exceeded"
      GenAiException.ErrorCode.BUSY -> "busy"
      GenAiException.ErrorCode.REQUEST_TOO_LARGE -> "context_exceeded"
      GenAiException.ErrorCode.NOT_AVAILABLE,
      GenAiException.ErrorCode.NEEDS_SYSTEM_UPDATE,
      GenAiException.ErrorCode.AICORE_INCOMPATIBLE,
      -> "model_not_ready"
      else -> "generation_failed"
    }

  companion object {
    private const val HARNESS_SCENARIO_EXTRA = "airgapProviderScenario"
    private const val MAX_INPUT_TOKENS = 4_000
    private const val MIN_OUTPUT_TOKENS = 64
    private const val DEFAULT_OUTPUT_TOKENS = 512
  }
}

private fun groundedPrompt(systemPrompt: String, userMessage: String): String =
  "$systemPrompt\n\nCustomer question and approved documents:\n$userMessage"

private typealias ReadableRequest = com.facebook.react.bridge.ReadableMap

private fun ReadableRequest.toMap(): Map<String, Any?> =
  hashMapOf(
    "requestId" to getString("requestId"),
    "systemPrompt" to getString("systemPrompt"),
    "userMessage" to getString("userMessage"),
  )
