package com.airgap.inference

import org.json.JSONObject

class ProviderHarnessException(message: String) : IllegalArgumentException(message)

data class ProviderHarnessCapability(
    val state: String,
    val contextSize: Int?,
    val modelIdentity: String?,
    val reason: String?,
)

data class ProviderHarnessGeneration(
    val tokens: List<String>,
    val text: String?,
    val error: String?,
)

data class ProviderHarnessScenario(
    val id: String,
    val platforms: List<String>,
    val capabilities: Map<String, ProviderHarnessCapability>,
    val generation: ProviderHarnessGeneration,
    val downloadProgress: List<Double>,
)

data class ProviderHarnessResolvedScenario(
    val id: String,
    val capability: ProviderHarnessCapability,
    val generation: ProviderHarnessGeneration,
    val downloadProgress: List<Double>,
)

object ProviderHarness {
    fun load(
        json: String,
        scenarioName: String,
        platform: String = "android",
    ): ProviderHarnessResolvedScenario {
        val normalizedName = scenarioName.trim()
        val normalizedPlatform = platform.trim().lowercase()
        val scenario = loadAll(json).firstOrNull { it.id == normalizedName }
            ?: throw ProviderHarnessException("provider_harness_scenario_unknown")
        val capability = scenario.capabilities[normalizedPlatform]
            ?: throw ProviderHarnessException("provider_harness_platform_unsupported")
        if (!scenario.platforms.contains(normalizedPlatform)) {
            throw ProviderHarnessException("provider_harness_platform_unsupported")
        }

        return ProviderHarnessResolvedScenario(
            id = scenario.id,
            capability = capability,
            generation = scenario.generation,
            downloadProgress = scenario.downloadProgress,
        )
    }

    fun loadAll(json: String): List<ProviderHarnessScenario> {
        val root = JSONObject(json)
        val scenarios = root.getJSONArray("scenarios")
        return (0 until scenarios.length()).map { index ->
            parseScenario(scenarios.getJSONObject(index))
        }
    }

    private fun parseScenario(json: JSONObject): ProviderHarnessScenario {
        val platforms = json.getJSONArray("platforms").let { values ->
            (0 until values.length()).map(values::getString)
        }
        val capabilitiesJson = json.getJSONObject("capabilities")
        val capabilities = capabilitiesJson.keys().asSequence().associateWith { platform ->
            parseCapability(capabilitiesJson.getJSONObject(platform))
        }
        val generationJson = json.getJSONObject("generation")
        val tokens = if (generationJson.has("tokens")) {
            generationJson.getJSONArray("tokens").let { values ->
                (0 until values.length()).map(values::getString)
            }
        } else {
            emptyList()
        }
        val progress = if (json.has("downloadProgress")) {
            json.getJSONArray("downloadProgress").let { values ->
                (0 until values.length()).map(values::getDouble)
            }
        } else {
            emptyList()
        }

        return ProviderHarnessScenario(
            id = json.getString("id"),
            platforms = platforms,
            capabilities = capabilities,
            generation = ProviderHarnessGeneration(
                tokens = tokens,
                text = generationJson.optionalString("text"),
                error = generationJson.optionalString("error"),
            ),
            downloadProgress = progress,
        )
    }

    private fun parseCapability(json: JSONObject) = ProviderHarnessCapability(
        state = json.getString("state"),
        contextSize = if (json.has("contextSize")) json.getInt("contextSize") else null,
        modelIdentity = json.optionalString("modelIdentity"),
        reason = json.optionalString("reason"),
    )

    private fun JSONObject.optionalString(name: String): String? =
        if (has(name) && !isNull(name)) getString(name) else null
}
