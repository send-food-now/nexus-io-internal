import styles from './chat.module.css'

export default function ChatPage() {
  return (
    <div className={styles.container}>
      <aside className={styles.sidebar}>
        <h2 className={styles.logo}>Nexus Chat</h2>
        <nav className={styles.channels}>
          <p className={styles.channelLabel}>Channels</p>
          <a href="#" className={styles.channel}># general</a>
          <a href="#" className={styles.channel}># random</a>
        </nav>
      </aside>
      <main className={styles.chatArea}>
        <header className={styles.chatHeader}>
          <h3># general</h3>
        </header>
        <div className={styles.messages}>
          <p className={styles.placeholder}>No messages yet. Start the conversation!</p>
        </div>
        <form className={styles.inputBar}>
          <input
            type="text"
            className={styles.input}
            placeholder="Type a message..."
          />
          <button type="submit" className={styles.sendBtn}>Send</button>
        </form>
      </main>
    </div>
  )
}
