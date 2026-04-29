// Jest setup — silence the structured logger during tests. Individual test
// cases still assert behavior through returned verdicts, so they don't need
// the noisy console output.
import {logger} from '../src/services/logger';

logger.setEnabled(false);
