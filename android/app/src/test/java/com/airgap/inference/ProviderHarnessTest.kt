package com.airgap.inference

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.BeforeClass
import org.junit.Test

class ProviderHarnessTest {
    companion object {
        private lateinit var manifest: String

        @JvmStatic
        @BeforeClass
        fun loadManifest() {
            val start = File(requireNotNull(System.getProperty("user.dir")))
            val file = generateSequence(start) { it.parentFile }
                .map { File(it, "validation/provider-scenarios.json") }
                .firstOrNull(File::isFile)
                ?: error("validation/provider-scenarios.json not found")
            manifest = file.readText()
        }
    }

    @Test
    fun loadsAvailableForBothPlatformsAndTrimsTheName() {
        val android = ProviderHarness.load(manifest, " available ", "android")
        val ios = ProviderHarness.load(manifest, "available", "ios")

        assertEquals("AVAILABLE", android.capability.state)
        assertEquals("available", ios.capability.state)
        assertEquals(2, android.generation.tokens.size)
    }

    @Test
    fun keepsDownloadableAndroidOnly() {
        val scenario = ProviderHarness.load(manifest, "downloadable", "android")
        assertEquals(listOf(0.0, 0.25, 0.75, 1.0), scenario.downloadProgress)

        try {
            ProviderHarness.load(manifest, "downloadable", "ios")
            fail("downloadable must not load on iOS")
        } catch (error: ProviderHarnessException) {
            assertEquals("provider_harness_platform_unsupported", error.message)
        }
    }

    @Test
    fun rejectsUnknownScenarios() {
        try {
            ProviderHarness.load(manifest, "missing", "android")
            fail("unknown scenario must fail")
        } catch (error: ProviderHarnessException) {
            assertEquals("provider_harness_scenario_unknown", error.message)
        }
    }

    @Test
    fun requiresSimulatedModelIdentities() {
        ProviderHarness.loadAll(manifest).forEach { scenario ->
            scenario.capabilities.values.forEach { capability ->
                capability.modelIdentity?.let { identity ->
                    assertTrue(identity.startsWith("simulated/"))
                }
            }
        }
    }
}
