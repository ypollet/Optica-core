export interface Developer {
  name: string
  role?: string
  url?: string
}

export interface Organization {
  name: string
  // url of the logo, the initials are shown without it
  logo?: string
  // invert the logo in dark mode (dark logos on transparent background)
  invert: boolean
  url?: string
  projects?: string[]
}

export interface CreditsContent {
  developers?: Developer[]
  projects?: Organization[]
  institutions?: Organization[]
}
