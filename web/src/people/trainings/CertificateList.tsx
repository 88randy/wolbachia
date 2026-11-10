import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DataTable } from "../../data-table/DataTable";
import { useTableUrlState } from "../../data-table/use-table-url-state";
import { operationTableData } from "../../operations/read-access";
import { certificatesOptions, TRAINING_PAGE_SIZE } from "./training-query";
import type { TrainingScope } from "./training-query";
import type { PersonContext } from "./person-context";
import { CERTIFICATE_TABLE, certificateTableQuery } from "./training-table";
import { useCertificateColumns } from "./certificate-columns";
const TABLE_SCOPE = { prefix: "person_" };
interface Props {
  scope: TrainingScope;
  context: PersonContext;
}
export function CertificateList({ scope, context }: Props) {
  const { t } = useTranslation();
  const table = useTableUrlState(CERTIFICATE_TABLE, TABLE_SCOPE);
  const query = useQuery(
    certificatesOptions(scope, {
      subject: context.subject,
      query: certificateTableQuery(table.state, context),
    }),
  );
  const columns = useCertificateColumns();
  return (
    <DataTable
      embedded
      caption={t("trainings.person.certificates")}
      columns={columns}
      controller={table}
      getRowId={(row) => row.id}
      data={operationTableData(query, table.state.page, TRAINING_PAGE_SIZE)}
    />
  );
}
