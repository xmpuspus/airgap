function fail(code) {
  throw new Error(code);
}

function androidIsVirtual(facts) {
  const text = [facts.serial, facts.model, facts.fingerprint].join(' ').toLowerCase();
  return (
    facts.qemu === '1' || /(emulator|sdk_gphone|generic_x86|virtual device|test-keys)/.test(text)
  );
}

function assessAndroidTarget(facts) {
  if (androidIsVirtual(facts)) fail('provider_target_android_virtual');
  if (!String(facts.aicorePackage ?? '').includes('com.google.android.aicore')) {
    fail('provider_target_android_aicore_missing');
  }
  return {...facts, deviceClass: 'physical-device', eligible: true};
}

function assessIosTarget(facts) {
  if (facts.simulator) fail('provider_target_ios_simulator');
  return {...facts, deviceClass: 'physical-device', eligible: true};
}

function assessFirebaseTarget(facts) {
  if (!facts.gcloudPath) fail('provider_firebase_gcloud_missing');
  if (!facts.project || facts.project === '(unset)') fail('provider_firebase_project_missing');
  if (!facts.model || /virtual/i.test(facts.modelForm ?? facts.model)) {
    fail('provider_firebase_physical_model_required');
  }
  return {...facts, eligible: true};
}

module.exports = {
  androidIsVirtual,
  assessAndroidTarget,
  assessFirebaseTarget,
  assessIosTarget,
};
