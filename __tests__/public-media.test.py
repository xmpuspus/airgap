"""Filesystem tests with copies of existing real captures, never showcase evidence."""
import hashlib
import importlib.util
import pathlib
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('public_media', ROOT / 'scripts/public_media.py')
media = importlib.util.module_from_spec(spec)
spec.loader.exec_module(media)


def identities(directory):
    return {file.name: hashlib.sha256(file.read_bytes()).hexdigest() for file in directory.iterdir() if file.is_file()}


class MediaPromotion(unittest.TestCase):
    def setUp(self):
        parent = ROOT / 'tmp/public-showcase'
        parent.mkdir(parents=True, exist_ok=True)
        self.temporary = tempfile.TemporaryDirectory(dir=parent)
        self.addCleanup(self.temporary.cleanup)
        self.run = pathlib.Path(self.temporary.name)
        # These are actual earlier host outputs. Copying them tests publication
        # mechanics only; this test never labels them a new or reviewed capture.
        self.release = self.run / 'release'
        media.shutil.copytree(ROOT / 'demo/public-service', self.release)
        self.before = identities(self.release)
        self.staged = media.prepare_release(self.release, self.run)

    def test_incomplete_export_leaves_previous_release_untouched(self):
        (self.staged / 'model-controls.mp4').unlink()
        with self.assertRaisesRegex(ValueError, 'missing'):
            media.promote_release(self.staged, self.release, self.run)
        self.assertEqual(identities(self.release), self.before)
        self.assertTrue(self.staged.exists())
        self.assertFalse((self.run / 'previous').exists())

    def test_complete_set_is_promoted_with_previous_set_retained(self):
        media.promote_release(self.staged, self.release, self.run)
        self.assertEqual(identities(self.release), self.before)
        self.assertEqual(identities(self.run / 'previous'), self.before)
        self.assertFalse(self.staged.exists())
        with self.assertRaisesRegex(ValueError, 'already has a previous'):
            media.promote_release(self.release, self.release, self.run)
        self.assertEqual(identities(self.release), self.before)

    def test_real_rename_error_restores_previous_release(self):
        # An authored filesystem fault: a stage nested in the release disappears
        # at its original path when the release moves. No OS call is mocked.
        nested = self.release / 'nested-stage'
        self.staged.rename(nested)
        with self.assertRaises(FileNotFoundError):
            media.promote_release(nested, self.release, self.run)
        self.assertEqual(identities(self.release), self.before)
        self.assertTrue(nested.exists())

    def test_recovery_after_actual_first_promotion_phase(self):
        media.preserve_previous(self.staged, self.release, self.run)
        self.assertFalse(self.release.exists())
        media.recover_release(self.release, self.run)
        self.assertEqual(identities(self.release), self.before)
        self.assertTrue(self.staged.exists())


if __name__ == '__main__':
    unittest.main()
