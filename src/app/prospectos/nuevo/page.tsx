import { ProspectForm } from "@/components/ProspectForm";
import { BackLink, PageTitle } from "@/components/ui";

export default function NewProspect() {
  return (
    <div className="mx-auto max-w-lg">
      <BackLink href="/pipeline">Pipeline</BackLink>
      <PageTitle title="Nuevo prospecto" />
      <ProspectForm />
    </div>
  );
}
