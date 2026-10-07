'use client'

import { useState } from 'react'
import {
  AlertCircle, ArrowUpRight, BriefcaseBusiness, CalendarDays, Check,
  CheckCircle2, ChevronDown, ChevronRight, Clock3, Download, FileCheck2,
  FileText, Files, Globe2, IdCard, Leaf, MapPin, MessageSquareText,
  MoreHorizontal, Search, ShieldCheck, UserPlus, Users,
} from 'lucide-react'
import styles from './IssuerHomeConcept.module.css'

type ModuleKey = 'activities' | 'passports' | 'volunteers' | 'documents' | 'programs'

const organizationName = 'Berkeley Neighbors'
const modules = [
  { id: 'activities' as const, label: 'Upcoming Activities', note: 'Schedule and staffing', metric: '6', icon: CalendarDays },
  { id: 'passports' as const, label: 'Passport Portal', note: 'Discover available people', metric: '18', icon: IdCard },
  { id: 'volunteers' as const, label: 'Volunteers', note: 'Roster and onboarding', metric: '42', icon: Users },
  { id: 'documents' as const, label: 'Organizational Documents', note: 'Shared requirements', metric: '12', icon: Files },
  { id: 'programs' as const, label: 'Volunteer Programs', note: 'Initiatives and progress', metric: '3', icon: BriefcaseBusiness },
]

const activities = [
  { id: 'packing', day: '09', month: 'OCT', title: 'Community Pantry Packing', time: '9:00–11:00 AM', place: 'North Berkeley Community Center', people: 10, capacity: 14, status: 'Needs 4 people', tone: 'attention' },
  { id: 'orientation', day: '12', month: 'OCT', title: 'Volunteer Welcome Session', time: '5:30–6:30 PM', place: 'Berkeley Neighbors Office', people: 8, capacity: 8, status: 'Fully staffed', tone: 'ready' },
  { id: 'delivery', day: '14', month: 'OCT', title: 'Senior Grocery Delivery Route', time: '10:00 AM–1:00 PM', place: 'West Berkeley', people: 4, capacity: 6, status: 'Needs 2 drivers', tone: 'attention' },
  { id: 'garden', day: '17', month: 'OCT', title: 'Fall Garden Workday', time: '10:00 AM–12:30 PM', place: 'Ohlone Community Garden', people: 7, capacity: 10, status: '3 places open', tone: 'open' },
]
const passports = [
  { id: 'maya', name: 'Maya Ortiz', initials: 'MO', skills: 'Food distribution · Spanish', availability: 'Weekday afternoons', match: 'Strong match', tone: 'sage' },
  { id: 'daniel', name: 'Daniel Kim', initials: 'DK', skills: 'Delivery driving · Logistics', availability: 'Saturday mornings', match: 'Driver qualified', tone: 'blue' },
  { id: 'ren', name: 'Ren Williams', initials: 'RW', skills: 'Community outreach · Design', availability: 'Flexible · 4 hrs/month', match: 'Open to invitations', tone: 'gold' },
  { id: 'sofia', name: 'Sofia Ahmed', initials: 'SA', skills: 'Youth programs · Facilitation', availability: 'Evenings', match: 'New to the network', tone: 'lilac' },
]
const volunteers = [
  { name: 'Alex Chen', initials: 'AC', role: 'Packing & garden team', status: 'Ready', next: 'Pantry Packing · Oct 9' },
  { name: 'Priya Patel', initials: 'PP', role: 'Delivery team', status: 'Ready', next: 'Delivery Route · Oct 14' },
  { name: 'Elena Brooks', initials: 'EB', role: 'Joining food access', status: 'Onboarding', next: 'Complete welcome' },
  { name: 'Jules Okafor', initials: 'JO', role: 'Design & communications', status: 'Available', next: 'No upcoming commitment' },
  { name: 'Sam Williams', initials: 'SW', role: 'Garden team', status: 'Needs review', next: 'Garden Workday · Oct 17' },
]
const documents = [
  { id: 'waiver', title: 'Volunteer Liability Waiver', type: 'Liability waiver', updated: 'Updated Sep 28', use: 'All public activities', tone: 'gold' },
  { id: 'agreement', title: 'Participation Agreement', type: 'Signature required', updated: 'Updated Sep 15', use: 'Volunteer onboarding', tone: 'blue' },
  { id: 'welcome', title: 'Welcome to Berkeley Neighbors', type: 'Volunteer resource', updated: 'Updated Sep 8', use: 'All volunteer roles', tone: 'sage' },
  { id: 'safety', title: 'Food Handling & Safety Guide', type: 'Training resource', updated: 'Updated Aug 22', use: 'Food Access program', tone: 'lilac' },
]
const programs = [
  { id: 'food', number: '01', title: 'Neighborhood Food Access', purpose: 'Reliable groceries and delivery support for local households.', lead: 'Priya Patel', progress: 72, activities: 4, volunteers: 23 },
  { id: 'neighbors', number: '02', title: 'Connected Neighbors', purpose: 'Friendly visits and practical support for older residents.', lead: 'Maya Thompson', progress: 48, activities: 2, volunteers: 11 },
  { id: 'green', number: '03', title: 'Community Green Spaces', purpose: 'Shared stewardship of neighborhood gardens and gathering places.', lead: 'Sam Williams', progress: 61, activities: 3, volunteers: 16 },
]

function ProfileRail() {
  return <aside className={styles.leftRail} aria-label="Organization profile">
    <section className={styles.profileCard}>
      <div className={styles.profileCover}><span><Leaf size={27} /></span></div>
      <div className={styles.profileIdentity}><span className={styles.profileMark}>BN</span><h2>{organizationName}</h2><span><MapPin size={11} /> Berkeley</span><p>Make everyday essentials and neighborhood connection available to everyone.</p></div>
      <nav className={styles.profileLinks} aria-label="Organization shortcuts">
        <button type="button"><Globe2 size={15} /><span>View Public Profile</span><ChevronRight size={14} /></button>
        <button type="button"><BriefcaseBusiness size={15} /><span>Volunteer programs</span><strong>3</strong></button>
        <button type="button"><Users size={15} /><span>Volunteer roster</span><strong>42</strong></button>
        <button type="button"><MessageSquareText size={15} /><span>Messages</span><strong>3</strong></button>
      </nav>
    </section>
    <section className={styles.railStatus}><div><span className={styles.statusPulse} /><small>ORGANIZATION STATUS</small></div><strong>Everything is moving.</strong><p>Five items need attention across your workspace.</p></section>
  </aside>
}

function ActivitiesPanel() {
  const [selected, setSelected] = useState('packing')
  const activity = activities.find(item => item.id === selected) || activities[0]
  return <section className={styles.modulePanel}>
    <PanelHeader eyebrow="UPCOMING ACTIVITIES" title="The next work your team is preparing for" copy="Review coverage, preparation, and the next operational decision."><button type="button" className={styles.primaryButton}>Schedule Activity <ArrowUpRight size={14} /></button></PanelHeader>
    <div className={styles.activityLayout}><div className={styles.activityList}>{activities.map(item => <button type="button" key={item.id} onClick={() => setSelected(item.id)} className={`${styles.activityRow} ${selected === item.id ? styles.selectedRow : ''}`}><span className={styles.dateTile}><small>{item.month}</small><strong>{item.day}</strong></span><span className={styles.rowCopy}><strong>{item.title}</strong><small><Clock3 size={11} /> {item.time}<i>·</i><MapPin size={11} /> {item.place}</small></span><span className={`${styles.statusTag} ${styles[item.tone]}`}>{item.status}</span><ChevronRight size={15} /></button>)}</div>
      <aside className={styles.activityDetail}><span className={styles.detailEyebrow}>STAFFING SNAPSHOT</span><h3>{activity.title}</h3><div className={styles.coverageNumber}><strong>{activity.people}</strong><span>of {activity.capacity}<small>confirmed</small></span></div><div className={styles.progressTrack}><span style={{ width: `${activity.people / activity.capacity * 100}%` }} /></div><div className={styles.detailFacts}><p><CheckCircle2 size={14} /> Activity details published</p><p><ShieldCheck size={14} /> Waiver attached</p><p><AlertCircle size={14} /> {activity.capacity - activity.people} open assignments</p></div><button type="button" className={styles.darkButton}>Open activity workspace <ArrowUpRight size={13} /></button></aside>
    </div>
  </section>
}

function PassportPanel() {
  const [invited, setInvited] = useState<string[]>([])
  return <section className={styles.modulePanel}>
    <PanelHeader eyebrow="PASSPORT PORTAL" title="Meet people who are open to contributing" copy="Review only the information each person has chosen to share with the City Network."><label className={styles.panelSearch}><Search size={14} /><input aria-label="Search passports" placeholder="Search skills or availability" /></label></PanelHeader>
    <div className={styles.passportGrid}>{passports.map(person => <article className={styles.passportCard} key={person.id}><div className={styles.passportTop}><span className={`${styles.personAvatar} ${styles[person.tone]}`}>{person.initials}</span><span className={styles.openBadge}><span /> OPEN</span></div><h3>{person.name}</h3><p>{person.skills}</p><small><Clock3 size={11} /> {person.availability}</small><div className={styles.passportMatch}>{person.match}</div><div className={styles.cardActions}><button type="button">View Passport</button><button type="button" className={invited.includes(person.id) ? styles.invitedButton : styles.inviteButton} onClick={() => setInvited(current => current.includes(person.id) ? current : [...current, person.id])}>{invited.includes(person.id) ? <><Check size={13} /> Invited</> : <><UserPlus size={13} /> Invite</>}</button></div></article>)}</div>
  </section>
}

function VolunteersPanel() {
  const [filter, setFilter] = useState('Everyone')
  const shown = volunteers.filter(person => filter === 'Everyone' || person.status === filter)
  return <section className={styles.modulePanel}>
    <PanelHeader eyebrow="VOLUNTEERS" title="Your organization’s people" copy="See readiness, current relationships, and the next commitment in one place."><button type="button" className={styles.primaryButton}><UserPlus size={14} /> Invite Volunteers</button></PanelHeader>
    <div className={styles.summaryStrip}><div><strong>42</strong><span>Roster members</span></div><div><strong>31</strong><span>Ready to serve</span></div><div><strong>7</strong><span>Onboarding</span></div><div><strong>4</strong><span>Available this week</span></div></div>
    <div className={styles.filterBar}>{['Everyone', 'Ready', 'Onboarding', 'Needs review'].map(item => <button type="button" key={item} onClick={() => setFilter(item)} className={filter === item ? styles.activeFilter : ''}>{item}</button>)}</div>
    <div className={styles.peopleTable}><div className={styles.tableHead}><span>VOLUNTEER</span><span>STATUS</span><span>NEXT STEP</span><span /></div>{shown.map(person => <button type="button" className={styles.personRow} key={person.name}><span className={styles.personName}><i>{person.initials}</i><span><strong>{person.name}</strong><small>{person.role}</small></span></span><span className={`${styles.personStatus} ${person.status === 'Ready' ? styles.ready : person.status === 'Onboarding' ? styles.open : person.status === 'Needs review' ? styles.attention : ''}`}>{person.status}</span><span className={styles.nextStep}>{person.next}</span><ChevronRight size={15} /></button>)}</div>
  </section>
}

function DocumentsPanel() {
  const [category, setCategory] = useState('All documents')
  const visible = documents.filter(document => category === 'All documents' || (category === 'Waivers' ? document.type.includes('waiver') : category === 'Requirements' ? document.type.includes('required') : document.type.includes('resource')))
  return <section className={styles.modulePanel}>
    <PanelHeader eyebrow="ORGANIZATIONAL DOCUMENTS" title="The resources that make participation clear" copy="Manage waivers, agreements, training material, and shared program documents."><button type="button" className={styles.primaryButton}>Add Document <ArrowUpRight size={14} /></button></PanelHeader>
    <div className={styles.documentCategories}>{['All documents', 'Waivers', 'Requirements', 'Resources'].map(item => <button type="button" onClick={() => setCategory(item)} className={category === item ? styles.activeCategory : ''} key={item}>{item}</button>)}</div>
    <div className={styles.documentList}>{visible.map(document => <article className={styles.documentRow} key={document.id}><span className={`${styles.documentIcon} ${styles[document.tone]}`}>{document.id === 'waiver' ? <FileCheck2 size={18} /> : <FileText size={18} />}</span><div><h3>{document.title}</h3><p>{document.type} <i>·</i> {document.updated}</p></div><span className={styles.documentUse}>{document.use}</span><button type="button" aria-label={`Download ${document.title}`}><Download size={15} /></button><button type="button" aria-label={`More options for ${document.title}`}><MoreHorizontal size={16} /></button></article>)}</div>
  </section>
}

function ProgramsPanel() {
  const [selected, setSelected] = useState('food')
  const active = programs.find(program => program.id === selected) || programs[0]
  return <section className={styles.modulePanel}>
    <PanelHeader eyebrow="VOLUNTEER PROGRAMS" title="Work organized around a clear purpose" copy="Track the initiatives that connect roles, activities, resources, and people."><button type="button" className={styles.primaryButton}>Create Program <ArrowUpRight size={14} /></button></PanelHeader>
    <div className={styles.programLayout}><div className={styles.programList}>{programs.map(program => <button type="button" key={program.id} className={`${styles.programRow} ${selected === program.id ? styles.selectedProgram : ''}`} onClick={() => setSelected(program.id)}><span>{program.number}</span><div><strong>{program.title}</strong><small>{program.lead} · {program.activities} activities</small></div><ChevronRight size={15} /></button>)}</div><article className={styles.programDetail}><span className={styles.detailEyebrow}>PROGRAM OVERVIEW</span><h3>{active.title}</h3><p>{active.purpose}</p><div className={styles.programStats}><div><strong>{active.progress}%</strong><span>Milestones complete</span></div><div><strong>{active.activities}</strong><span>Active activities</span></div><div><strong>{active.volunteers}</strong><span>Volunteers involved</span></div></div><div className={styles.programProgress}><span style={{ width: `${active.progress}%` }} /></div><footer><span><Users size={14} /> Program Lead: <strong>{active.lead}</strong></span><button type="button" className={styles.darkButton}>Open Program <ArrowUpRight size={13} /></button></footer></article></div>
  </section>
}

function PanelHeader({ eyebrow, title, copy, children }: { eyebrow: string, title: string, copy: string, children: React.ReactNode }) {
  return <header className={styles.panelHeader}><div><span>{eyebrow}</span><h2>{title}</h2><p>{copy}</p></div>{children}</header>
}

export default function IssuerHomeOperatingBrief() {
  const [activeModule, setActiveModule] = useState<ModuleKey>('activities')
  return <main className={styles.page}>
    <header className={styles.appHeader}><div className={styles.appHeaderInner}><div className={styles.brandLockup}><img src="/brand/mycity-logo-gold-blue-on-white.svg" alt="mycity" /><span /><div><small>COORDINATION STUDIO</small><b>Organization Home Concept</b></div></div><nav className={styles.topNav} aria-label="Organization sections"><button type="button" className={styles.activeTopNav}>Home</button><button type="button">Workspace</button><button type="button">Volunteers</button></nav><div className={styles.headerContext}><button type="button" className={styles.messageButton}><MessageSquareText size={15} /> Messages <span>3</span></button><button type="button" className={styles.profileButton} aria-label={`${organizationName} profile`}><span>BN</span><ChevronDown size={14} /></button></div></div></header>
    <div className={styles.quickBar}><div><button type="button" className={styles.activeQuick}>Home</button><button type="button">+ Schedule Activity</button><button type="button">+ Create a Role</button><button type="button">+ Invite Volunteers</button><button type="button">Staff</button><button type="button">Calendar</button></div></div>
    <div className={styles.shell}><div className={styles.commandLayout}><ProfileRail /><section className={styles.dashboard} aria-label="Organization command center"><header className={styles.dashboardHeading}><div><span>WEDNESDAY, OCTOBER 7</span><h1>Organization command center</h1><p>Choose an area to see what is moving, what needs attention, and what to do next.</p></div><div className={styles.liveStatus}><span /><strong>Workspace live</strong><small>Last updated just now</small></div></header><div className={styles.moduleGrid} role="tablist" aria-label="Dashboard areas">{modules.map(module => { const Icon = module.icon; const selected = activeModule === module.id; return <button type="button" role="tab" aria-selected={selected} key={module.id} onClick={() => setActiveModule(module.id)} className={`${styles.moduleButton} ${selected ? styles.activeModule : ''}`}><span className={styles.moduleMetric}>{module.metric}</span><span className={styles.moduleIcon}><Icon size={23} /></span><span><strong>{module.label}</strong><small>{module.note}</small></span><ChevronRight size={16} /></button> })}</div><div key={activeModule} className={styles.moduleContent}>{activeModule === 'activities' ? <ActivitiesPanel /> : activeModule === 'passports' ? <PassportPanel /> : activeModule === 'volunteers' ? <VolunteersPanel /> : activeModule === 'documents' ? <DocumentsPanel /> : <ProgramsPanel />}</div></section></div></div>
  </main>
}
