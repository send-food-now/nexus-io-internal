import styles from './page.module.css'

export default function Home() {
  return (
    <main className={styles.main}>
      <div className={styles.hero}>
        <h1 className={styles.title}>Nexus Chat</h1>
        <p className={styles.subtitle}>Real-time messaging, reimagined.</p>
        <div className={styles.actions}>
          <a href="/chat" className={styles.primaryBtn}>
            Start Chatting
          </a>
        </div>
      </div>
    </main>
  )
}
