import { isEmpty } from 'lodash-es';
import { FC, useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import type { DashboardProvider } from '@nuclearplayer/plugin-sdk';
import { Button, Loader, ViewShell } from '@nuclearplayer/ui';
import { useProviders } from '../../hooks/useProviders';
import { useStartupStore } from '../../stores/startupStore';
import { DashboardEmptyState } from './components/DashboardEmptyState';
import { PowerToolsWidget } from './components/PowerToolsWidget';
import { DASHBOARD_WIDGETS, DashboardWidgetEntry } from './dashboardWidgets';

const DashboardContent: FC<{
  isStartingUp: boolean;
  activeWidgets: DashboardWidgetEntry[];
}> = ({ isStartingUp, activeWidgets }) => {
  if (isStartingUp) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader data-testid="dashboard-loader" size="xl" />
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button asChild variant="text">
          <Link to="/charts">Charts</Link>
        </Button>
      </div>
      <PowerToolsWidget />
      {isEmpty(activeWidgets) ? (
        <DashboardEmptyState />
      ) : (
        activeWidgets.map(({ capability, component: Widget }) => (
          <Widget key={capability} />
        ))
      )}
    </>
  );
};

export const Dashboard: FC = () => {
  const { t } = useTranslation('dashboard');
  const isStartingUp = useStartupStore((state) => state.isStartingUp);
  const providers = useProviders('dashboard') as DashboardProvider[];

  const activeWidgets = useMemo(() => {
    const capabilities = new Set(
      providers.flatMap((provider) => provider.capabilities),
    );

    return DASHBOARD_WIDGETS.filter((widget) =>
      capabilities.has(widget.capability),
    );
  }, [providers]);

  return (
    <ViewShell data-testid="dashboard-view" title={t('title')}>
      <DashboardContent
        isStartingUp={isStartingUp}
        activeWidgets={activeWidgets}
      />
    </ViewShell>
  );
};
