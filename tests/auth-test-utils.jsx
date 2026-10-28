import axios from 'axios';

import { apiClient } from '../client/src/auth/apiClient.js';

let requests = [];
let originalAdapter;

export function installApiAdapter(handler) {
  requests = [];
  originalAdapter = apiClient.defaults.adapter;
  apiClient.defaults.adapter = async (config) => {
    requests.push(config);
    const result = await handler(config);
    const status = result.status ?? 200;
    const response = {
      data: result.data ?? null,
      status,
      statusText: String(status),
      headers: {},
      config,
      request: {},
    };

    if (status >= 200 && status < 300) {
      return response;
    }

    throw new axios.AxiosError(
      result.data?.error ?? `Request failed with status ${status}`,
      'ERR_BAD_RESPONSE',
      config,
      {},
      response
    );
  };
}

export function resetApiAdapter() {
  if (originalAdapter === undefined) {
    delete apiClient.defaults.adapter;
  } else {
    apiClient.defaults.adapter = originalAdapter;
  }

  requests = [];
  originalAdapter = undefined;
}

export function getApiRequests() {
  return requests;
}

export function getAuthorizationHeader(config) {
  return config.headers?.Authorization ?? config.headers?.get?.('Authorization') ?? null;
}
