jest.mock('react-native-mmkv', () => require('./helpers/rn-mocks').rnMmkv());
jest.mock('../src/services/secureStorage', () => require('./helpers/rn-mocks').secureStorage());
jest.mock('../src/config/loader', () => ({
  features: {sessionTimeoutMinutes: 30},
  privacy: {dataRetentionDays: 30},
}));

import {conversationStore} from '../src/services/conversationStore';

describe('conversation store', () => {
  beforeEach(() => conversationStore.clear());
  afterEach(() => jest.restoreAllMocks());

  test('restores message dates and prompt turns from one snapshot', () => {
    conversationStore.save({
      messages: [
        {
          _id: 'message-1',
          text: 'Hello',
          createdAt: new Date('2026-08-12T00:00:00.000Z'),
          user: {_id: 'user', name: 'You'},
        },
      ],
      turns: [{role: 'user', text: 'Hello'}],
    });

    const snapshot = conversationStore.load();

    expect(snapshot.messages[0].createdAt).toBeInstanceOf(Date);
    expect(snapshot.messages[0].createdAt.toISOString()).toBe('2026-08-12T00:00:00.000Z');
    expect(snapshot.turns).toEqual([{role: 'user', text: 'Hello'}]);
  });

  test('clears visible messages and prompt turns together', () => {
    conversationStore.save({
      messages: [],
      turns: [{role: 'bot', text: 'Stored'}],
    });

    conversationStore.clear();

    expect(conversationStore.load()).toEqual({messages: [], turns: []});
  });

  test('notifies a mounted conversation view when all state is cleared', () => {
    const listener = jest.fn();
    const unsubscribe = conversationStore.subscribe(listener);
    conversationStore.save({
      messages: [],
      turns: [{role: 'bot', text: 'Stored'}],
    });

    conversationStore.clear();

    expect(listener).toHaveBeenLastCalledWith({messages: [], turns: []});
    unsubscribe();
  });

  test('expires the full snapshot after the session timeout', () => {
    jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(1_000)
      .mockReturnValue(31 * 60 * 1000);
    conversationStore.save({messages: [], turns: [{role: 'user', text: 'Old'}]});

    expect(conversationStore.load()).toEqual({messages: [], turns: []});
  });
});
