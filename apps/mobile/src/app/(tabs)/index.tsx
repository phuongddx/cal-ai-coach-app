import { useEffect, useMemo } from 'react';

import { EmberView } from '../../features/ember/EmberView';
import { useEmberState } from '../../features/ember/emberStore';
import { fixtureTargets } from '../../features/ember/fixture';
import { writeFirstRender } from '../../spike/firstRender';

export default function EmberScreen() {
  const { meals, isOffline } = useEmberState();
  const now = useMemo(() => new Date(), []);

  useEffect(() => {
    writeFirstRender();
  }, []);

  return <EmberView meals={meals} targets={fixtureTargets} now={now} isOffline={isOffline} streakDays={0} />;
}
