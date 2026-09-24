import type { SVGProps } from 'react'

function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  )
}

export function DashboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="13.5" y="3.5" width="7" height="4.5" rx="1.2" />
      <rect x="13.5" y="10.5" width="7" height="10" rx="1.2" />
      <rect x="3.5" y="13" width="7" height="7.5" rx="1.2" />
    </Icon>
  )
}

export function PatientsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c0-3.5 2.5-6 5.5-6s5.5 2.5 5.5 6" />
      <circle cx="17" cy="8.5" r="2.4" />
      <path d="M15 14.3c2.3.3 4 2.4 4 5.7" />
    </Icon>
  )
}

export function ReferenceIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 6.5C10 5 7 4.5 4 4.5v14c3 0 6 .5 8 2 2-1.5 5-2 8-2v-14c-3 0-6 .5-8 2z" />
      <path d="M12 6.5v14" />
    </Icon>
  )
}

export function CalculatorIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="5" y="3" width="14" height="18" rx="1.5" />
      <path d="M8 7h8" />
      <path d="M8 11h.01M12 11h.01M16 11h.01M8 14.5h.01M12 14.5h.01M16 14.5h.01M8 18h.01M12 18h.01M16 18h.01" />
    </Icon>
  )
}

export function ChecklistIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M9 3.5h6a1 1 0 011 1v1.2h1.2a1.8 1.8 0 011.8 1.8v12a1.8 1.8 0 01-1.8 1.8H6.8A1.8 1.8 0 015 19.5v-12A1.8 1.8 0 016.8 5.7H8V4.5a1 1 0 011-1z" />
      <path d="M8.5 12.5l2 2 4-4.2" />
    </Icon>
  )
}

export function AcademyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 4L3 8.5 12 13l9-4.5L12 4z" />
      <path d="M6.5 10.6V15c0 1.7 2.5 3.2 5.5 3.2s5.5-1.5 5.5-3.2v-4.4" />
    </Icon>
  )
}

export function StudyHubIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="2.2" />
      <circle cx="12" cy="4.5" r="1.6" />
      <circle cx="5" cy="16" r="1.6" />
      <circle cx="19" cy="16" r="1.6" />
      <path d="M12 6.1v3.7M10.3 13.5l-3.8 1.7M13.7 13.5l3.8 1.7" />
    </Icon>
  )
}

export function FlashcardsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="7.5" y="3.5" width="12" height="9" rx="1.3" />
      <rect x="4.5" y="8" width="12" height="9" rx="1.3" fill="var(--surface, #fff)" />
    </Icon>
  )
}

export function ReasoningIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 5.5A2.5 2.5 0 016.5 3h11A2.5 2.5 0 0120 5.5v8a2.5 2.5 0 01-2.5 2.5H10l-4.5 4v-4H6.5A2.5 2.5 0 014 13.5v-8z" />
      <path d="M10.3 9.2a1.7 1.7 0 113.2.8c-.3.6-1.1.9-1.3 1.5M12 13.2h.01" />
    </Icon>
  )
}

export function KnowledgeGapIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 3a6 6 0 00-3.5 10.9c.6.4 1 .9 1 1.6v.5h5v-.5c0-.7.4-1.2 1-1.6A6 6 0 0012 3z" />
      <path d="M9.7 18h4.6M10.5 21h3" />
    </Icon>
  )
}

export function PersonalCaseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 6.2a1 1 0 011-1h4.3l1.4 1.8H19a1 1 0 011 1V18a1 1 0 01-1 1H5a1 1 0 01-1-1V6.2z" />
    </Icon>
  )
}

export function ResearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M10 3h4" />
      <path d="M10.5 3v5.5L5.8 18a1.8 1.8 0 001.6 2.6h9.2a1.8 1.8 0 001.6-2.6l-4.7-9.5V3" />
      <path d="M8 15h8" />
    </Icon>
  )
}

export function AssessmentIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M9 3.5h6a1 1 0 011 1v1.2h1.2a1.8 1.8 0 011.8 1.8v12a1.8 1.8 0 01-1.8 1.8H6.8A1.8 1.8 0 015 19.5v-12A1.8 1.8 0 016.8 5.7H8V4.5a1 1 0 011-1z" />
      <path d="M7.5 13l1.8-2.6 1.7 3.4 1.8-5 1.7 4.2" />
    </Icon>
  )
}

export function LabsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M9 2.5h6" />
      <path d="M9.7 3v11.5a2.8 2.8 0 005.6 0V3" />
      <path d="M9.7 13.5h5.6" />
    </Icon>
  )
}

export function TrendsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <path d="M7 15.5l3.2-4.3 2.6 2.6L18 6.5" />
    </Icon>
  )
}

export function NotesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M7 3.5h7l4 4v13a1 1 0 01-1 1H7a1 1 0 01-1-1v-16a1 1 0 011-1z" />
      <path d="M14 3.5v4h4" />
      <path d="M9 12.5h6M9 16h6" />
    </Icon>
  )
}

export function MedicationsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect
        x="4.5"
        y="9.5"
        width="15"
        height="6"
        rx="3"
        transform="rotate(-45 12 12.5)"
      />
      <path d="M12 8.5l4 4" />
    </Icon>
  )
}

export function ImagingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="4.5" width="17" height="14" rx="1.5" />
      <circle cx="9" cy="9.5" r="1.4" />
      <path d="M4.5 16.5l4-4.3 3 3 3.5-4 4.5 5.3" />
    </Icon>
  )
}

export function RemindersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 3.2a2 2 0 00-2 2v.4C7.3 6.4 6 8.7 6 11.5v4L4.3 17.5h15.4L18 15.5v-4c0-2.8-1.3-5.1-4-5.9v-.4a2 2 0 00-2-2z" />
      <path d="M10 20a2 2 0 004 0" />
    </Icon>
  )
}

export function OverviewIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
      <circle cx="12" cy="12" r="2.6" />
    </Icon>
  )
}

export function FormBuilderIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 6h5M13 6h7M4 12h9M17 12h3M4 18h11M19 18h1" />
      <circle cx="8" cy="6" r="1.6" />
      <circle cx="14" cy="12" r="1.6" />
      <circle cx="16" cy="18" r="1.6" />
    </Icon>
  )
}

export function DataIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="4" y="4" width="16" height="16" rx="1.5" />
      <path d="M4 9.5h16M4 14.5h16M9.5 4v16M14.5 4v16" />
    </Icon>
  )
}

export function AnalyticsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <rect x="7" y="13" width="2.4" height="5" />
      <rect x="11.3" y="9" width="2.4" height="9" />
      <rect x="15.6" y="6" width="2.4" height="12" />
    </Icon>
  )
}

export function WarningIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 4.2L3 19.5h18L12 4.2z" />
      <path d="M12 10v4.2M12 17.2h.01" />
    </Icon>
  )
}

export function DownloadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 3.5v11.5M7.5 10.5l4.5 4.5 4.5-4.5" />
      <path d="M4.5 17v2a1.5 1.5 0 001.5 1.5h12a1.5 1.5 0 001.5-1.5v-2" />
    </Icon>
  )
}

export function GrowthIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 4v16h16" />
      <path d="M8 16c1.5-4 3-6 4.5-6s2 3 3.5 3 2.5-4.5 4-7" />
      <circle cx="20" cy="6" r="1.2" fill="currentColor" stroke="none" />
    </Icon>
  )
}

export function DropletIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 3.3s6.5 7 6.5 11.4a6.5 6.5 0 01-13 0C5.5 10.3 12 3.3 12 3.3z" />
    </Icon>
  )
}

export function DocumentIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
    </Icon>
  )
}

export function CaseLogIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M9 3.5h6a1 1 0 011 1v1.2h1.2a1.8 1.8 0 011.8 1.8v12a1.8 1.8 0 01-1.8 1.8H6.8A1.8 1.8 0 015 19.5v-12A1.8 1.8 0 016.8 5.7H8V4.5a1 1 0 011-1z" />
      <path d="M8.5 11h7M8.5 14.5h7M8.5 18h4.5" />
    </Icon>
  )
}

export function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5" width="17" height="15" rx="1.8" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </Icon>
  )
}

export function SettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.2M12 18.8V21M21 12h-2.2M5.2 12H3M18.4 5.6l-1.55 1.55M7.15 16.85L5.6 18.4M18.4 18.4l-1.55-1.55M7.15 7.15L5.6 5.6" />
    </Icon>
  )
}

export function KidneyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M32 5c15 0 26 13 26 28S47 61 33 61c-8 0-15-4-19-11-2-4-1-8 3-10 5-3 5-9 0-12-4-2-5-6-3-10 4-7 11-13 18-13z" />
    </svg>
  )
}
