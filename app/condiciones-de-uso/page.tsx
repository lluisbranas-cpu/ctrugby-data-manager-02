import { LegalPage } from "@/app/components/legal-page";
import { productTitle, brand } from "@/lib/brand";

export const metadata = { title: `Condiciones de uso | ${productTitle}` };

export default function CondicionesDeUsoPage() {
  return <LegalPage eyebrow="CONDICIONES" title="Condiciones de uso" updated="17 de octubre de 2026" sections={[
    { title: "Aceptación", content: <p>Al acceder o utilizar {brand.hub} aceptas estas condiciones. Si no estás de acuerdo con ellas, no debes utilizar la aplicación.</p> },
    { title: "Acceso y cuentas", content: <p>Algunas funcionalidades requieren una cuenta o autorización. La persona usuaria es responsable de custodiar sus credenciales y de comunicar cualquier uso no autorizado a XXXX.</p> },
    { title: "Normas de uso", content: <p>No está permitido manipular, extraer masivamente, difundir sin autorización o utilizar los datos disponibles para fines ilícitos, discriminatorios o que vulneren derechos de terceros.</p> },
    { title: "Contenido y correcciones", content: <p>La información puede actualizarse, corregirse o retirarse cuando sea necesario. Puedes comunicar posibles errores mediante el formulario de contacto.</p> },
    { title: "Modificaciones", content: <p>XXXX podrá actualizar estas condiciones cuando sea necesario. La versión vigente estará disponible en esta página e indicará la fecha de su última actualización.</p> },
  ]} />;
}
