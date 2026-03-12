export default function AboutPage() {
  return (
    <div className="how-to-layout">
      <div className="how-to-page">
        <h1>About Pancake</h1>

        <section>
          <h2>About Pancake</h2>

          <p>
            Pancake is named after my one eyed calico cat, who is a sweetheart.
            She has been one of my greatest supporters, always sitting in my lap while I work on this project.
            Scroll down for some photos of her!
            <br></br><br></br>As for me, I'm a software engineer by trade, and I built this project as a personal tool to assist in development with AI.
            I find that one of my largest bottlenecks is just trying to manage multiple agent sessions simultaneously when working
            on rapid development. I didn't have a clean way to organize the sessions, keep them all informed, and allow editing simultaneously.
            After starting development, I found that I really enjoyed working with Pancake and continued to implement some even more interesting
            use-cases, for example having agent sessions talk to each other for monitoring, managing, or fun. Pancake is specifically helpful for
            fast iteration, when I have lots of ideas but have to wait for agents to load and talk, even if I want to develop separate ideas simultaneously.
            <br></br><br></br><strong>If you're a user who enjoys using this and wants to talk, a contributor who wants to contribute, or anyone else who wants to make contact with me, feel free to contact
            me at any of the links below.</strong>
          </p>
        </section>

        <section>
          <h2>Links and Contact</h2>
          <div className="about-links">
            <a href="https://www.linkedin.com/in/GabeMousa" target="_blank" rel="noreferrer" className="about-link-card">
              <span className="about-link-label">LinkedIn</span>
              <span className="about-link-url">linkedin.com/in/GabeMousa</span>
            </a>
            <a href="https://github.com/gabe-mousa" target="_blank" rel="noreferrer" className="about-link-card">
              <span className="about-link-label">GitHub</span>
              <span className="about-link-url">github.com/gabe-mousa</span>
            </a>
            <a href="https://gabe-mousa.github.io/gabemousa-website/" target="_blank" rel="noreferrer" className="about-link-card">
              <span className="about-link-label">Website</span>
              <span className="about-link-url">gabe-mousa.github.io</span>
            </a>
            <a href="mailto:gab.01@hotmail.com" className="about-link-card">
              <span className="about-link-label">Email</span>
              <span className="about-link-url">gab.01@hotmail.com</span>
            </a>
          </div>
        </section>

        <section>
          <h2>Support</h2>
          <p>I would greatly appreciate any support through GitHub Stars on this <a href="https://github.com/gabe-mousa/pancake">repo</a>!</p>
        </section>

        <section>
          <h2>Pancake's Gallery</h2>
          <div className="pancake-gallery">
            <div className="pancake-gallery-track">
              {[1,2,3,4,5,6,7,1,2,3,4,5,6,7].map((n, i) => (
                <img
                  key={i}
                  src={`/pancake${n}.jpg`}
                  alt={`Pancake photo ${n}`}
                  className="pancake-gallery-img"
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
