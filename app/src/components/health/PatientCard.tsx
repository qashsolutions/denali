/**
 * PatientCard — DISABLED (Privacy §2 compliance)
 *
 * This component previously displayed full legal name and mailing address
 * from the FHIR Patient resource. Privacy Policy §2 states we do NOT collect
 * full legal names or mailing addresses, so this component is disabled.
 *
 * It was already dead code (never imported by any page or component).
 * Kept as a commented reference in case the privacy policy is updated
 * to permit displaying this data in the future.
 */

// "use client";
//
// import type { PatientSummary } from "@/lib/fhir/transforms";
//
// interface PatientCardProps {
//   patient: PatientSummary;
// }
//
// export function PatientCard({ patient }: PatientCardProps) {
//   return (
//     <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border)] p-5">
//       <div className="flex items-center gap-4">
//         <div className="w-12 h-12 rounded-full bg-[var(--health-red)]/15 flex items-center justify-center flex-shrink-0">
//           <span className="text-[var(--health-red)] text-lg font-bold">
//             {patient.name.charAt(0)}
//           </span>
//         </div>
//         <div className="min-w-0">
//           <h3 className="text-lg font-bold text-[var(--text-primary)] truncate">
//             {patient.name}
//           </h3>
//           <p className="text-sm text-[var(--text-secondary)]">
//             {patient.age} years old · {patient.gender}
//           </p>
//         </div>
//       </div>
//
//       <div className="mt-4 grid grid-cols-2 gap-3">
//         <div className="bg-[var(--bg-tertiary)] rounded-xl px-3 py-2">
//           <p className="text-xs text-[var(--text-muted)] mb-0.5">Medicare ID</p>
//           <p className="text-sm font-medium text-[var(--text-primary)]">{patient.medicareId}</p>
//         </div>
//         <div className="bg-[var(--bg-tertiary)] rounded-xl px-3 py-2">
//           <p className="text-xs text-[var(--text-muted)] mb-0.5">Date of Birth</p>
//           <p className="text-sm font-medium text-[var(--text-primary)]">{patient.dateOfBirth}</p>
//         </div>
//         {patient.address && (
//           <div className="bg-[var(--bg-tertiary)] rounded-xl px-3 py-2 col-span-2">
//             <p className="text-xs text-[var(--text-muted)] mb-0.5">Location</p>
//             <p className="text-sm font-medium text-[var(--text-primary)]">
//               {patient.address.city}, {patient.address.state} {patient.address.zip}
//             </p>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }
