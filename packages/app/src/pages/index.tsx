import {
  ACLShortcut,
  AdminLayout,
  AntdConfigProvider,
  AntdSchemaComponentProvider,
  APIClientProvider,
  AuthLayout,
  CollectionManagerProvider,
  CollectionManagerShortcut,
  compose,
  DesignableSwitch,
  DocumentTitleProvider,
  i18n,
  PluginManagerProvider,
  RouteSchemaComponent,
  RouteSwitch,
  RouteSwitchProvider,
  SchemaComponentProvider,
  SigninPage,
  SignupPage,
  SystemSettingsProvider,
  SystemSettingsShortcut,
  useRequest
} from '@nocobase/client';
import { Spin } from 'antd';
import 'antd/dist/antd.css';
import React from 'react';
import { I18nextProvider } from 'react-i18next';
import { Link, NavLink } from 'react-router-dom';
import apiClient from './apiClient';

const providers = [
  // [HashRouter],
  // [MemoryRouter, { initialEntries: ['/'] }],
  [APIClientProvider, { apiClient }],
  [I18nextProvider, { i18n }],
  [AntdConfigProvider, { remoteLocale: true }],
  SystemSettingsProvider,
  [
    PluginManagerProvider,
    { components: { ACLShortcut, DesignableSwitch, CollectionManagerShortcut, SystemSettingsShortcut } },
  ],
  [SchemaComponentProvider, { components: { Link, NavLink } }],
  CollectionManagerProvider,
  AntdSchemaComponentProvider,
  [DocumentTitleProvider, { addonAfter: 'NocoBase' }],
  [RouteSwitchProvider, { components: { AuthLayout, AdminLayout, RouteSchemaComponent, SigninPage, SignupPage } }],
];

const App = compose(...providers)(() => {
  const { data, loading } = useRequest({
    url: 'uiRoutes:getAccessible',
  });
  if (loading) {
    return <Spin />;
  }
  return (
    <div>
      <RouteSwitch routes={data?.data || []} />
    </div>
  );
});

export default App;
