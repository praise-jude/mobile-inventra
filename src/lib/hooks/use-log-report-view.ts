import { useEffect, useRef } from 'react';

import { logAudit } from '@/lib/actions/audit';
import { useMyProfile } from '@/lib/hooks/use-my-profile';

// Shared by the three reports/*.tsx screens — logs once per screen mount
// on first successful data load (a "viewed this report" usage signal),
// not once per react-query background refetch. Same pattern as
// ask-ai.tsx's inline version, pulled out here since three screens need
// the identical logic with just a different report name.
export function useLogReportView(reportName: string, ready: boolean): void {
  const profileQuery = useMyProfile();
  const logged = useRef(false);

  useEffect(() => {
    if (logged.current || !ready || !profileQuery.data) return;
    logged.current = true;
    const profile = profileQuery.data;
    void logAudit({
      orgId: profile.org_id,
      actorId: profile.id,
      actorName: `${profile.first_name} ${profile.last_name}`,
      actorRole: profile.role,
      action: 'report.viewed',
      module: 'Reports',
      entityType: 'report',
      entityLabel: reportName,
    });
  }, [ready, profileQuery.data, reportName]);
}
