'use client'

import { useState, type ReactNode } from 'react'
import {
  ArrowLeft, ArrowUpRight, BriefcaseBusiness, CalendarDays, Check,
  ChevronDown, ChevronRight, Clock3, Download, FileCheck2, FileText, Files,
  Globe2, IdCard, Leaf, MapPin, MessageSquareText, MoreHorizontal, Search,
  Plus, Radio, Send, ShieldCheck, UserPlus, Users,
} from 'lucide-react'
import styles from './IssuerHomeConcept.module.css'

type ModuleKey = 'activities' | 'passports' | 'volunteers' | 'documents' | 'programs'
type RosterMember = { name: string; initials: string; assignment: string; status: 'Confirmed' | 'Lead' | 'Pending' }
type ProgramActivity = { id: string; title: string; date: string; time: string; place: string; status: string; volunteers: RosterMember[] }

const organizationName = 'Berkeley Neighbors'
const modules = [
  { id: 'activities' as const, label: 'Upcoming Activities', note: 'Schedule and staffing', icon: CalendarDays },
  { id: 'passports' as const, label: 'Passport Portal', note: 'Discover available people', icon: IdCard },
  { id: 'volunteers' as const, label: 'Volunteers', note: 'Roster and onboarding', icon: Users },
  { id: 'documents' as const, label: 'Organizational Documents', note: 'Shared requirements', icon: Files },
  { id: 'programs' as const, label: 'Volunteer Programs', note: 'Initiatives and progress', icon: BriefcaseBusiness },
]

const activityRosters: Record<string, RosterMember[]> = {
  packing: [
    { name: 'Alex Chen', initials: 'AC', assignment: 'Packing station lead', status: 'Lead' },
    { name: 'Maya Ortiz', initials: 'MO', assignment: 'Pantry packing', status: 'Confirmed' },
    { name: 'Jules Okafor', initials: 'JO', assignment: 'Intake and labeling', status: 'Confirmed' },
    { name: 'Elena Brooks', initials: 'EB', assignment: 'Pantry packing', status: 'Pending' },
  ],
  orientation: [
    { name: 'Maya Thompson', initials: 'MT', assignment: 'Session facilitator', status: 'Lead' },
    { name: 'Elena Brooks', initials: 'EB', assignment: 'New volunteer', status: 'Confirmed' },
    { name: 'Theo Martin', initials: 'TM', assignment: 'New volunteer', status: 'Confirmed' },
  ],
  delivery: [
    { name: 'Priya Patel', initials: 'PP', assignment: 'Route coordinator', status: 'Lead' },
    { name: 'Daniel Kim', initials: 'DK', assignment: 'Driver · Route 2', status: 'Confirmed' },
    { name: 'Nina Foster', initials: 'NF', assignment: 'Delivery partner', status: 'Confirmed' },
  ],
  garden: [
    { name: 'Sam Williams', initials: 'SW', assignment: 'Garden lead', status: 'Lead' },
    { name: 'Ren Williams', initials: 'RW', assignment: 'Workday volunteer', status: 'Confirmed' },
    { name: 'Alex Chen', initials: 'AC', assignment: 'Workday volunteer', status: 'Confirmed' },
  ],
}

const activities = [
  { id: 'packing', day: '09', month: 'OCT', title: 'Community Pantry Packing', time: '9:00–11:00 AM', place: 'North Berkeley Community Center', status: 'Needs 4 people', tone: 'attention' },
  { id: 'orientation', day: '12', month: 'OCT', title: 'Volunteer Welcome Session', time: '5:30–6:30 PM', place: 'Berkeley Neighbors Office', status: 'Fully staffed', tone: 'ready' },
  { id: 'delivery', day: '14', month: 'OCT', title: 'Senior Grocery Delivery Route', time: '10:00 AM–1:00 PM', place: 'West Berkeley', status: 'Needs 2 drivers', tone: 'attention' },
  { id: 'garden', day: '17', month: 'OCT', title: 'Fall Garden Workday', time: '10:00 AM–12:30 PM', place: 'Ohlone Community Garden', status: '3 places open', tone: 'open' },
]
const passports = [
  { id: 'maya', name: 'Maya Ortiz', initials: 'MO', skills: 'Food distribution · Spanish', availability: 'Weekday afternoons', match: 'Strong match', tone: 'sage' },
  { id: 'daniel', name: 'Daniel Kim', initials: 'DK', skills: 'Delivery driving · Logistics', availability: 'Saturday mornings', match: 'Driver qualified', tone: 'blue' },
  { id: 'ren', name: 'Ren Williams', initials: 'RW', skills: 'Community outreach · Design', availability: 'Flexible · 4 hrs/month', match: 'Open to invitations', tone: 'gold' },
  { id: 'sofia', name: 'Sofia Ahmed', initials: 'SA', skills: 'Youth programs · Facilitation', availability: 'Evenings', match: 'New to the network', tone: 'lilac' },
]
const volunteers = [
  { id: 'alex', name: 'Alex Chen', initials: 'AC', role: 'Packing & garden team', status: 'Ready', next: 'Pantry Packing · Oct 9', city: 'Berkeley, CA', availability: 'Weekday mornings', skills: ['Food packing', 'Garden stewardship', 'Team lead'], languages: 'English · Mandarin', hours: '46 verified hours', experience: ['Community Pantry Packing · 12 shifts', 'Fall Garden Workday · 4 shifts'], training: ['Participation Agreement', 'Food Handling & Safety'] },
  { id: 'priya', name: 'Priya Patel', initials: 'PP', role: 'Delivery team', status: 'Ready', next: 'Delivery Route · Oct 14', city: 'Berkeley, CA', availability: 'Tuesdays and Saturdays', skills: ['Route planning', 'Delivery driving', 'Client care'], languages: 'English · Hindi', hours: '82 verified hours', experience: ['Senior Grocery Delivery · 23 routes', 'Pantry Distribution · 6 shifts'], training: ['Driver verification', 'Client privacy', 'Participation Agreement'] },
  { id: 'elena', name: 'Elena Brooks', initials: 'EB', role: 'Joining food access', status: 'Onboarding', next: 'Complete welcome', city: 'Oakland, CA', availability: 'Thursday evenings', skills: ['Hospitality', 'Food packing'], languages: 'English', hours: '6 verified hours', experience: ['Volunteer Welcome Session', 'Community Pantry Packing · 2 shifts'], training: ['Participation Agreement'] },
  { id: 'jules', name: 'Jules Okafor', initials: 'JO', role: 'Design & communications', status: 'Available', next: 'No upcoming commitment', city: 'Berkeley, CA', availability: 'Flexible · 4 hrs/month', skills: ['Graphic design', 'Community outreach', 'Photography'], languages: 'English · French', hours: '34 verified hours', experience: ['Neighborhood Resource Guide', 'Fall Campaign'], training: ['Participation Agreement', 'Community storytelling'] },
  { id: 'sam', name: 'Sam Williams', initials: 'SW', role: 'Garden team', status: 'Needs review', next: 'Garden Workday · Oct 17', city: 'Berkeley, CA', availability: 'Weekend mornings', skills: ['Garden stewardship', 'Tool safety', 'Mentoring'], languages: 'English', hours: '67 verified hours', experience: ['Community Garden · 18 shifts', 'Seedling Day'], training: ['Tool Safety', 'Participation Agreement'] },
]
const documents = [
  { id: 'waiver', title: 'Volunteer Liability Waiver', type: 'Liability waiver', updated: 'Updated Sep 28', use: 'All public activities', tone: 'gold' },
  { id: 'agreement', title: 'Participation Agreement', type: 'Signature required', updated: 'Updated Sep 15', use: 'Volunteer onboarding', tone: 'blue' },
  { id: 'welcome', title: 'Welcome to Berkeley Neighbors', type: 'Volunteer resource', updated: 'Updated Sep 8', use: 'All volunteer roles', tone: 'sage' },
  { id: 'safety', title: 'Food Handling & Safety Guide', type: 'Training resource', updated: 'Updated Aug 22', use: 'Food Access program', tone: 'lilac' },
]
const programActivities: Record<string, ProgramActivity[]> = {
  food: [
    { id: 'food-packing', title: 'Community Pantry Packing', date: 'Friday, October 9', time: '9:00–11:00 AM', place: 'North Berkeley Community Center', status: 'Needs 4 people', volunteers: activityRosters.packing },
    { id: 'food-delivery', title: 'Senior Grocery Delivery Route', date: 'Wednesday, October 14', time: '10:00 AM–1:00 PM', place: 'West Berkeley', status: 'Needs 2 drivers', volunteers: activityRosters.delivery },
    { id: 'food-intake', title: 'Pantry Intake & Sorting', date: 'Tuesday, October 20', time: '3:00–5:00 PM', place: 'Berkeley Neighbors Office', status: 'Fully staffed', volunteers: [activityRosters.packing[0], activityRosters.packing[2]] },
  ],
  neighbors: [
    { id: 'welcome-call', title: 'Friendly Call Orientation', date: 'Monday, October 12', time: '5:30–6:30 PM', place: 'Online', status: 'Fully staffed', volunteers: activityRosters.orientation },
    { id: 'visits', title: 'Neighborhood Visit Round', date: 'Saturday, October 24', time: '10:00 AM–12:00 PM', place: 'Central Berkeley', status: '2 places open', volunteers: [activityRosters.orientation[0], activityRosters.packing[1]] },
  ],
  green: [
    { id: 'garden-day', title: 'Fall Garden Workday', date: 'Saturday, October 17', time: '10:00 AM–12:30 PM', place: 'Ohlone Community Garden', status: '3 places open', volunteers: activityRosters.garden },
    { id: 'tool-care', title: 'Garden Tool Care', date: 'Thursday, October 22', time: '4:00–5:30 PM', place: 'Ohlone Community Garden', status: 'Fully staffed', volunteers: [activityRosters.garden[0], activityRosters.garden[2]] },
  ],
}
const programs = [
  { id: 'food', number: '01', title: 'Neighborhood Food Access', lead: 'Priya Patel' },
  { id: 'neighbors', number: '02', title: 'Connected Neighbors', lead: 'Maya Thompson' },
  { id: 'green', number: '03', title: 'Community Green Spaces', lead: 'Sam Williams' },
]

function ProfileRail() {
  return <aside className={styles.leftRail} aria-label="Organization profile">
    <section className={styles.profileCard}><div className={styles.profileCover}><span><Leaf size={27} /></span></div><div className={styles.profileIdentity}><span className={styles.profileMark}>BN</span><h2>{organizationName}</h2><span><MapPin size={11} /> Berkeley</span><p>Make everyday essentials and neighborhood connection available to everyone.</p></div><nav className={styles.profileLinks} aria-label="Organization shortcuts"><button type="button"><Globe2 size={15} /><span>View Public Profile</span><ChevronRight size={14} /></button><button type="button"><BriefcaseBusiness size={15} /><span>Volunteer programs</span><strong>3</strong></button><button type="button"><Users size={15} /><span>Volunteer roster</span><strong>42</strong></button><button type="button"><MessageSquareText size={15} /><span>Messages</span><strong>3</strong></button></nav></section>
    <section className={styles.railStatus}><div><span className={styles.statusPulse} /><small>ORGANIZATION STATUS</small></div><strong>Everything is moving.</strong><p>Five items need attention across your workspace.</p></section>
  </aside>
}

function OverviewHero() {
  const currentDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date())

  return <section className={styles.overviewHero} aria-label="Organization overview">
    <div className={styles.overviewHeroCopy}>
      <p><CalendarDays size={13} /> {currentDate}</p>
      <h1>{organizationName}</h1>
      <span>Coordinate your organization’s people, commitments, and community presence.</span>
    </div>
    <div className={styles.overviewHeroActions}>
      <button type="button" className={styles.overviewFeedButton}><Radio size={14} /> MyCity Feed</button>
      <div>
        <button type="button" className={styles.overviewPrimaryAction}><Plus size={14} /> Schedule Activity</button>
        <button type="button"><Plus size={14} /> Create a Role</button>
        <button type="button"><Plus size={14} /> Invite Volunteers</button>
        <button type="button"><Users size={14} /> Staff</button>
      </div>
    </div>
  </section>
}

function RosterList({ people }: { people: RosterMember[] }) {
  return <div className={styles.rosterList}>{people.map(person => <div className={styles.rosterPerson} key={`${person.name}-${person.assignment}`}><span className={styles.rosterAvatar}>{person.initials}</span><span><strong>{person.name}</strong><small>{person.assignment}</small></span><em className={person.status === 'Pending' ? styles.pendingRoster : ''}>{person.status}</em></div>)}</div>
}

function ActivitiesPanel() {
  const [selected, setSelected] = useState('packing')
  const activity = activities.find(item => item.id === selected) || activities[0]
  const roster = activityRosters[activity.id]
  return <section className={styles.modulePanel}><PanelHeader title="Upcoming Activities"><button type="button" className={styles.primaryButton}>Schedule Activity <ArrowUpRight size={14} /></button></PanelHeader><div className={styles.activityLayout}><div className={styles.activityList}>{activities.map(item => <button type="button" key={item.id} onClick={() => setSelected(item.id)} className={`${styles.activityRow} ${selected === item.id ? styles.selectedRow : ''}`}><span className={styles.dateTile}><small>{item.month}</small><strong>{item.day}</strong></span><span className={styles.rowCopy}><strong>{item.title}</strong><small><Clock3 size={11} /> {item.time}<i>·</i><MapPin size={11} /> {item.place}</small></span><span className={`${styles.statusTag} ${styles[item.tone]}`}>{item.status}</span><ChevronRight size={15} /></button>)}</div><aside className={styles.activityDetail}><div className={styles.detailTitle}><span>COMMITTED ROSTER</span><strong>{roster.length}</strong></div><h3>{activity.title}</h3><RosterList people={roster} /><div className={styles.detailActions}><button type="button"><Send size={13} /> Message Team</button><button type="button"><Users size={13} /> Manage Roster</button><button type="button" className={styles.darkButton}>Open Activity <ArrowUpRight size={13} /></button></div></aside></div></section>
}

function PassportPanel() {
  const [invited, setInvited] = useState<string[]>([])
  return <section className={styles.modulePanel}><PanelHeader title="Passport Portal"><label className={styles.panelSearch}><Search size={14} /><input aria-label="Search passports" placeholder="Search skills or availability" /></label></PanelHeader><div className={styles.passportGrid}>{passports.map(person => <article className={styles.passportCard} key={person.id}><div className={styles.passportTop}><span className={`${styles.personAvatar} ${styles[person.tone]}`}>{person.initials}</span><span className={styles.openBadge}><span /> OPEN</span></div><h3>{person.name}</h3><p>{person.skills}</p><small><Clock3 size={11} /> {person.availability}</small><div className={styles.passportMatch}>{person.match}</div><div className={styles.cardActions}><button type="button">View Passport</button><button type="button" className={invited.includes(person.id) ? styles.invitedButton : styles.inviteButton} onClick={() => setInvited(current => current.includes(person.id) ? current : [...current, person.id])}>{invited.includes(person.id) ? <><Check size={13} /> Invited</> : <><UserPlus size={13} /> Invite</>}</button></div></article>)}</div></section>
}

function VolunteersPanel() {
  const [filter, setFilter] = useState('Everyone')
  const [selected, setSelected] = useState(volunteers[0].id)
  const shown = volunteers.filter(person => filter === 'Everyone' || person.status === filter)
  const person = volunteers.find(item => item.id === selected) || volunteers[0]
  return <section className={styles.modulePanel}><PanelHeader title="Volunteers"><button type="button" className={styles.primaryButton}><UserPlus size={14} /> Invite Volunteers</button></PanelHeader><div className={styles.filterBar}>{['Everyone', 'Ready', 'Onboarding', 'Needs review'].map(item => <button type="button" key={item} onClick={() => setFilter(item)} className={filter === item ? styles.activeFilter : ''}>{item}</button>)}</div><div className={styles.volunteerLayout}><div className={styles.volunteerList}>{shown.map(item => <button type="button" className={`${styles.volunteerRow} ${selected === item.id ? styles.selectedVolunteer : ''}`} key={item.id} onClick={() => setSelected(item.id)}><span className={styles.personName}><i>{item.initials}</i><span><strong>{item.name}</strong><small>{item.role}</small></span></span><span className={`${styles.personStatus} ${item.status === 'Ready' ? styles.ready : item.status === 'Onboarding' ? styles.open : item.status === 'Needs review' ? styles.attention : ''}`}>{item.status}</span><ChevronRight size={15} /></button>)}</div><aside className={styles.passportPreview}><div className={styles.passportHeading}><span>{person.initials}</span><div><small>VOLUNTEER PASSPORT</small><h3>{person.name}</h3><p><MapPin size={11} /> {person.city}</p></div><button type="button">Open Passport <ArrowUpRight size={12} /></button></div><div className={styles.passportFacts}><div><small>AVAILABILITY</small><strong>{person.availability}</strong></div><div><small>CONTRIBUTIONS</small><strong>{person.hours}</strong></div><div><small>LANGUAGES</small><strong>{person.languages}</strong></div></div><section className={styles.passportSection}><small>SKILLS & EXPERIENCE</small><div className={styles.skillTags}>{person.skills.map(skill => <span key={skill}>{skill}</span>)}</div></section><section className={styles.passportSection}><small>VOLUNTEER EXPERIENCE</small>{person.experience.map(item => <p key={item}><Check size={12} /> {item}</p>)}</section><section className={styles.passportSection}><small>READY TO SERVE</small>{person.training.map(item => <p key={item}><ShieldCheck size={12} /> {item}</p>)}</section><div className={styles.passportActions}><button type="button"><Send size={13} /> Message</button><button type="button" className={styles.darkButton}>Assign to Activity</button></div></aside></div></section>
}

function DocumentsPanel() {
  const [category, setCategory] = useState('All documents')
  const visible = documents.filter(document => category === 'All documents' || (category === 'Waivers' ? document.type.includes('waiver') : category === 'Requirements' ? document.type.includes('required') : document.type.includes('resource')))
  return <section className={styles.modulePanel}><PanelHeader title="Organizational Documents"><button type="button" className={styles.primaryButton}>Add Document <ArrowUpRight size={14} /></button></PanelHeader><div className={styles.documentCategories}>{['All documents', 'Waivers', 'Requirements', 'Resources'].map(item => <button type="button" onClick={() => setCategory(item)} className={category === item ? styles.activeCategory : ''} key={item}>{item}</button>)}</div><div className={styles.documentList}>{visible.map(document => <article className={styles.documentRow} key={document.id}><span className={`${styles.documentIcon} ${styles[document.tone]}`}>{document.id === 'waiver' ? <FileCheck2 size={18} /> : <FileText size={18} />}</span><div><h3>{document.title}</h3><p>{document.type} <i>·</i> {document.updated}</p></div><span className={styles.documentUse}>{document.use}</span><button type="button" aria-label={`Download ${document.title}`}><Download size={15} /></button><button type="button" aria-label={`More options for ${document.title}`}><MoreHorizontal size={16} /></button></article>)}</div></section>
}

function ProgramsPanel() {
  const [selectedProgram, setSelectedProgram] = useState('food')
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null)
  const program = programs.find(item => item.id === selectedProgram) || programs[0]
  const scheduled = programActivities[program.id]
  const activity = scheduled.find(item => item.id === selectedActivity)
  const chooseProgram = (id: string) => { setSelectedProgram(id); setSelectedActivity(null) }
  return <section className={styles.modulePanel}><PanelHeader title="Volunteer Programs"><button type="button" className={styles.primaryButton}>Create Program <ArrowUpRight size={14} /></button></PanelHeader><div className={`${styles.programWorkspace} ${activity ? styles.activityDrilldown : ''}`}>{!activity && <div className={styles.programList}>{programs.map(item => <button type="button" key={item.id} className={`${styles.programRow} ${selectedProgram === item.id ? styles.selectedProgram : ''}`} onClick={() => chooseProgram(item.id)}><span>{item.number}</span><div><strong>{item.title}</strong><small>Program Lead · {item.lead}</small></div><ChevronRight size={15} /></button>)}</div>}<div className={styles.programActivities}><div className={styles.activityColumnTitle}>{activity && <button type="button" onClick={() => setSelectedActivity(null)}><ArrowLeft size={13} /> Programs</button>}<span>{program.title}</span><strong>Scheduled Activities</strong></div>{scheduled.map(item => <button type="button" key={item.id} onClick={() => setSelectedActivity(item.id)} className={`${styles.programActivityRow} ${selectedActivity === item.id ? styles.selectedProgramActivity : ''}`}><span className={styles.programActivityDate}>{item.date.split(', ')[1]?.split(' ')[1] || '09'}<small>OCT</small></span><span><strong>{item.title}</strong><small>{item.date} · {item.time}</small></span><em>{item.status}</em><ChevronRight size={14} /></button>)}</div><article className={styles.programActivityDetail}>{activity ? <><div className={styles.activityDetailHeading}><small>ACTIVITY DETAILS</small><h3>{activity.title}</h3><span className={styles.statusTag}>{activity.status}</span></div><div className={styles.activityMeta}><p><CalendarDays size={14} /> {activity.date} · {activity.time}</p><p><MapPin size={14} /> {activity.place}</p></div><div className={styles.detailTitle}><span>SIGNED-UP VOLUNTEERS</span><strong>{activity.volunteers.length}</strong></div><RosterList people={activity.volunteers} /><div className={styles.detailActions}><button type="button"><Send size={13} /> Message Team</button><button type="button" className={styles.darkButton}>Manage Activity <ArrowUpRight size={13} /></button></div></> : <><span className={styles.programNumber}>{program.number}</span><small>SELECTED PROGRAM</small><h3>{program.title}</h3><p>Choose a scheduled activity to review its details and participating volunteers.</p><div className={styles.programLead}><Users size={15} /><span>Program Lead<strong>{program.lead}</strong></span></div></>}</article></div></section>
}

function PanelHeader({ title, children }: { title: string; children?: ReactNode }) {
  return <header className={styles.panelHeader}><h2>{title}</h2>{children}</header>
}

export default function IssuerHomeOperatingBrief() {
  const [activeModule, setActiveModule] = useState<ModuleKey>('activities')
  return <main className={styles.page}><header className={styles.appHeader}><div className={styles.appHeaderInner}><div className={styles.brandLockup}><img src="/brand/mycity-logo-gold-blue-on-white.svg" alt="mycity" /><span /><div><small>COORDINATION STUDIO</small><b>Organization Home Concept</b></div></div><nav className={styles.topNav} aria-label="Organization sections"><button type="button" className={styles.activeTopNav}>Home</button><button type="button">Workspace</button><button type="button">Volunteers</button></nav><div className={styles.headerContext}><button type="button" className={styles.messageButton}><MessageSquareText size={15} /> Messages <span>3</span></button><button type="button" className={styles.profileButton} aria-label={`${organizationName} profile`}><span>BN</span><ChevronDown size={14} /></button></div></div></header><div className={styles.quickBar}><div><button type="button" className={styles.activeQuick}>Home</button><button type="button">+ Schedule Activity</button><button type="button">+ Create a Role</button><button type="button">+ Invite Volunteers</button><button type="button">Staff</button><button type="button">Calendar</button></div></div><div className={styles.shell}><OverviewHero /><div className={styles.commandLayout}><ProfileRail /><section className={styles.dashboard} aria-label="Organization command center"><div className={styles.moduleGrid} role="tablist" aria-label="Dashboard areas">{modules.map(module => { const Icon = module.icon; const selected = activeModule === module.id; return <button type="button" role="tab" aria-selected={selected} key={module.id} onClick={() => setActiveModule(module.id)} className={`${styles.moduleButton} ${selected ? styles.activeModule : ''}`}><span className={styles.moduleIcon}><Icon size={18} /></span><span><strong>{module.label}</strong><small>{module.note}</small></span><ChevronRight size={15} /></button> })}</div><div key={activeModule} className={styles.moduleContent}>{activeModule === 'activities' ? <ActivitiesPanel /> : activeModule === 'passports' ? <PassportPanel /> : activeModule === 'volunteers' ? <VolunteersPanel /> : activeModule === 'documents' ? <DocumentsPanel /> : <ProgramsPanel />}</div></section></div></div></main>
}
