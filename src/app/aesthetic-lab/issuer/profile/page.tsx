import {
  ArrowUpRight,
  BadgeCheck,
  Building2,
  Check,
  Edit3,
  Globe2,
  Heart,
  MapPin,
  Share2,
  Sparkles,
  UsersRound,
} from 'lucide-react'
import { LabHeader } from '../../LabHeader'
import { IssuerLabSidebar } from '../IssuerLabSidebar'
import styles from '../../prototype.module.css'

const profileChecks = ['Mission and cause areas', 'Primary location and contact path', 'Active opportunities and onboarding', 'Current liability waiver']

export default function IssuerProfileLabPage() {
  return (
    <main className={styles.app}>
      <LabHeader activeSection="issuer-profile" workspace="issuer" />
      <div className={styles.issuerLayout}>
        <IssuerLabSidebar active="profile" />

        <section className={styles.issuerMain} aria-label="Public Profile">
          <section className={styles.issuerPageHero}>
            <div><p className={styles.eyebrow}>Public profile</p><h1>Let people recognize the work.</h1><p>This is the first page a potential volunteer sees before deciding whether to join your organization.</p></div>
            <button type="button" className={styles.issuerPrimaryAction}><Edit3 size={17} /> Edit profile</button>
          </section>

          <section className={styles.profilePreviewCard}>
            <div className={styles.publicProfileCover}><span><Building2 size={24} /></span><i /><i /><i /></div>
            <div className={styles.publicProfileBody}>
              <div className={styles.publicOrgMark}>EB</div>
              <div className={styles.publicProfileTopline}><p className={styles.eyebrow}>Food access · Berkeley, CA</p><span><BadgeCheck size={16} /> Verified organization</span></div>
              <h2>East Bay Food Collective</h2>
              <p className={styles.publicProfileMission}>A neighborhood-powered pantry building dignified, reliable access to good food—one shared shift at a time.</p>
              <div className={styles.publicProfileMeta}><span><MapPin size={15} /> Berkeley, California</span><span><UsersRound size={15} /> 23 active volunteers</span><span><Heart size={15} /> Food access</span></div>
              <div className={styles.publicProfileActions}><button type="button"><Share2 size={15} /> Share profile</button><button type="button"><Globe2 size={15} /> View as public</button></div>
            </div>
          </section>

          <section className={styles.profileEditorGrid}>
            <section className={styles.profileEditCard}>
              <div className={styles.issuerPanelHeading}><div><p className={styles.eyebrow}>Profile information</p><h2>What your page communicates</h2></div><Edit3 size={18} /></div>
              <div className={styles.profileFieldList}>
                <article><span>Mission</span><p>A neighborhood-powered pantry serving Berkeley with reliable access to fresh food.</p><button type="button" aria-label="Edit mission"><Edit3 size={15} /></button></article>
                <article><span>Cause areas</span><p>Food access · Community care · Neighbor support</p><button type="button" aria-label="Edit causes"><Edit3 size={15} /></button></article>
                <article><span>Location</span><p>Berkeley Food Hub · 2012 Ninth Street</p><button type="button" aria-label="Edit location"><Edit3 size={15} /></button></article>
              </div>
            </section>
            <section className={styles.profileReadyCard}><span><Sparkles size={20} /></span><p className={styles.eyebrow}>Profile readiness</p><h2>Ready to welcome new people.</h2><p>Everything a volunteer needs to understand your work is present and current.</p><div>{profileChecks.map((item) => <span key={item}><Check size={14} /> {item}</span>)}</div></section>
          </section>

          <section className={styles.profilePublicCard}>
            <div><p className={styles.eyebrow}>Public experience</p><h2>What happens next for someone visiting your page.</h2></div>
            <ol><li><b>1</b><span>They understand your mission and current local work.</span></li><li><b>2</b><span>They see an onboarding session or open opportunity.</span></li><li><b>3</b><span>They join with clear expectations and verified context.</span></li></ol>
            <a href="#">Preview public profile <ArrowUpRight size={15} /></a>
          </section>
        </section>
      </div>
    </main>
  )
}
