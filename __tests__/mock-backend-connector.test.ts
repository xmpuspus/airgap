// The mock connector answers with the template's own mock text and states a
// result without a follow-up promise. A REST backend needs a base URL.

jest.mock('../src/services/secureStorage', () => require('./helpers/rn-mocks').secureStorage());

import {actions, brand, config, interpolate} from '../src/config/loader';
import {MockBackendConnector} from '../src/services/backendConnector';

const PROMISE = /look into|I'll|I will|will be|let me/i;

describe('mock backend connector', () => {
  const backend = new MockBackendConnector();

  it('returns the configured mock response for a configured action', async () => {
    const action = actions.find(item => item.mockResponse);
    expect(action).toBeDefined();

    const result = await backend.executeAction(action!.id, {query: 'test'});

    expect(result.message).toBe(interpolate(action!.mockResponse!, config));
  });

  it('reads the action list of the active config', async () => {
    const original = config.actions;
    config.actions = [
      {
        id: 'prescription_refill',
        label: 'Prescription refill',
        keywords: ['refill'],
        requiresOnline: true,
        mockResponse: '{{brandName}} sent the refill request.',
      },
    ];
    try {
      const result = await backend.executeAction('prescription_refill', {});

      expect(result.message).toBe(`${brand.name} sent the refill request.`);
    } finally {
      config.actions = original;
    }
  });

  it('states a plain result for an action without a mock response', async () => {
    const result = await backend.executeAction('bookAppointment', {query: 'Book appointment'});

    expect(result.message).not.toContain('bookAppointment');
    expect(result.message).not.toMatch(PROMISE);
  });

  it('states only the result of a plan change', async () => {
    const result = await backend.changePlan('current', '');

    expect(result.message).not.toContain('Switch to Plan');
    expect(result.message).not.toMatch(PROMISE);
  });
});

describe('backend built from config', () => {
  it('rejects a REST backend without a base URL', () => {
    jest.isolateModules(() => {
      jest.doMock('../src/config/loader', () => ({config: {backend: {type: 'rest'}}}));

      expect(() => require('../src/services/backendConnector')).toThrow('backend.baseUrl');
    });
  });
});
