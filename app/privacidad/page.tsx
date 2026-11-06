import Link from "@/app/components/sport-link";
import { LegalPage } from "@/app/components/legal-page";

export const metadata = { title: "Privacidad | RUGBY - HUB" };

export default function PrivacidadPage() {
  return <LegalPage eyebrow="PROTECCIÓN DE DATOS" title="Política de privacidad" updated="17 de octubre de 2026" sections={[
    { title: "Responsable del tratamiento", content: <p>El responsable del tratamiento es <strong>XXXX</strong>, con NIF/CIF XXXX, domicilio en XXXX y correo de contacto XXXX.</p> },
    { title: "Datos que tratamos", content: <p>Podemos tratar datos identificativos y de contacto que facilites en el formulario de contacto, así como los datos necesarios para gestionar el acceso privado o público a la aplicación. La aplicación puede contener datos deportivos y profesionales incorporados para sus finalidades de directorio y gestión.</p> },
    { title: "Finalidades y base jurídica", content: <p>Usamos estos datos para atender consultas, gestionar solicitudes de acceso, mantener la seguridad del servicio y administrar el directorio. La base jurídica será el consentimiento, la ejecución de medidas solicitadas por la persona usuaria, el cumplimiento de obligaciones legales o el interés legítimo, según corresponda.</p> },
    { title: "Conservación y destinatarios", content: <p>Conservaremos los datos durante el tiempo necesario para cada finalidad y, después, durante los plazos legales aplicables. No se cederán datos a terceros salvo obligación legal o cuando sea necesario para prestar el servicio mediante proveedores contratados.</p> },
    { title: "Tus derechos", content: <><p>Puedes solicitar acceso, rectificación, supresión, oposición, limitación o portabilidad de tus datos escribiendo a <strong>XXXX</strong>. También puedes retirar tu consentimiento en cualquier momento, sin afectar al tratamiento previo.</p><p>Si consideras que el tratamiento no se ajusta a la normativa, puedes presentar una reclamación ante la Agencia Española de Protección de Datos.</p></> },
    { title: "Más información", content: <p>Para consultas sobre esta política, utiliza el <Link className="font-bold text-red-700 hover:underline" href="/contacto">formulario de contacto</Link>.</p> },
  ]} />;
}
