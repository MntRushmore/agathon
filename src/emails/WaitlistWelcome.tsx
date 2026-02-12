import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface WaitlistWelcomeProps {
  name?: string;
}

export default function WaitlistWelcome({ name }: WaitlistWelcomeProps) {
  const greeting = name ? `Hey ${name}!` : 'Hey!';

  return (
    <Html>
      <Head />
      <Preview>You&apos;re on the Agathon waitlist — we&apos;ll be in touch soon.</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Logo */}
          <Section style={logoSection}>
            <Img
              src="https://agathon.app/logo/agathon.png"
              width="180"
              alt="Agathon"
              style={logo}
            />
          </Section>

          <Hr style={divider} />

          {/* Content */}
          <Section style={content}>
            <Heading style={heading}>{greeting}</Heading>

            <Text style={paragraph}>
              Thanks for signing up — we&apos;re really excited to have you on the list.
            </Text>

            <Text style={paragraph}>
              We&apos;re building <strong>Agathon</strong> because we believe you
              deserve an AI learning companion that doesn&apos;t just give you
              answers — it helps you actually understand. Whether you&apos;re tackling
              algebra or diving into calculus, Agathon adapts to how you think and
              learns with you.
            </Text>

            <Heading as="h2" style={subheading}>
              What&apos;s next:
            </Heading>

            <Text style={listItem}>
              <span style={bullet}>—</span> We&apos;ll let you in as soon as we can
            </Text>
            <Text style={listItem}>
              <span style={bullet}>—</span> Early folks get free credits to explore
            </Text>
            <Text style={listItem}>
              <span style={bullet}>—</span> We&apos;ll send you updates as we build —
              new features, experiments, and things we think you&apos;ll love
            </Text>

            <Text style={paragraph}>
              Hit reply if you want to say hi or tell us what you&apos;re working on. We
              actually read these.
            </Text>

            <Text style={signoff}>
              — The Agathon Team
            </Text>
          </Section>

          <Hr style={divider} />

          {/* Footer */}
          <Section style={footer}>
            <Img
              src="https://agathon.app/logo/agathon.png"
              width="100"
              alt="Agathon"
              style={footerLogo}
            />
            <Text style={footerText}>
              The AI learning companion for students, teachers, and parents.
            </Text>
            <Text style={footerLinks}>
              <Link href="https://agathon.app" style={footerLink}>
                agathon.app
              </Link>
              {' · '}
              <Link href="https://agathon.app/privacy" style={footerLink}>
                Privacy
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/* ─── Styles ─── */

const main: React.CSSProperties = {
  backgroundColor: '#f5f5f5',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const container: React.CSSProperties = {
  maxWidth: '600px',
  margin: '0 auto',
  backgroundColor: '#ffffff',
};

const logoSection: React.CSSProperties = {
  padding: '40px 48px 24px',
};

const logo: React.CSSProperties = {
  display: 'block',
};

const divider: React.CSSProperties = {
  borderColor: '#e5e5e5',
  borderWidth: '1px 0 0 0',
  margin: '0 48px',
};

const content: React.CSSProperties = {
  padding: '32px 48px',
};

const heading: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: '700',
  color: '#1a1a1a',
  lineHeight: '1.3',
  margin: '0 0 20px',
};

const subheading: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: '700',
  color: '#1a1a1a',
  lineHeight: '1.3',
  margin: '28px 0 16px',
};

const paragraph: React.CSSProperties = {
  fontSize: '16px',
  lineHeight: '1.6',
  color: '#333333',
  margin: '0 0 16px',
};

const listItem: React.CSSProperties = {
  fontSize: '16px',
  lineHeight: '1.6',
  color: '#333333',
  margin: '0 0 8px',
  paddingLeft: '4px',
};

const bullet: React.CSSProperties = {
  color: '#007ba5',
  fontWeight: '700',
  marginRight: '8px',
};

const signoff: React.CSSProperties = {
  fontSize: '16px',
  lineHeight: '1.6',
  color: '#333333',
  margin: '28px 0 0',
  fontWeight: '600',
};

const footer: React.CSSProperties = {
  padding: '24px 48px 40px',
  textAlign: 'center' as const,
};

const footerLogo: React.CSSProperties = {
  display: 'block',
  margin: '0 auto 12px',
  opacity: 0.6,
};

const footerText: React.CSSProperties = {
  fontSize: '13px',
  lineHeight: '1.5',
  color: '#999999',
  margin: '0 0 8px',
};

const footerLinks: React.CSSProperties = {
  fontSize: '13px',
  lineHeight: '1.5',
  color: '#999999',
  margin: '0',
};

const footerLink: React.CSSProperties = {
  color: '#007ba5',
  textDecoration: 'none',
};
