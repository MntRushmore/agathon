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

interface ReferralAnnouncementProps {
  name?: string;
  referralCode: string;
}

export default function ReferralAnnouncement({ name, referralCode }: ReferralAnnouncementProps) {
  const greeting = name ? `Hey ${name}!` : 'Hey!';
  const referralLink = `https://agathon.app?ref=${referralCode}`;

  return (
    <Html>
      <Head />
      <Preview>You now have a referral link — share it and earn cash rewards.</Preview>
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
              We just launched something new for everyone on the waitlist:{' '}
              <strong>referral rewards</strong>.
            </Text>

            <Text style={paragraph}>
              You now have a personal referral link. Every time someone joins the
              Agathon waitlist through your link, it counts as a referral. The more
              people you bring in, the higher you climb on our public leaderboard —
              and <strong>top referrers earn cash rewards</strong>.
            </Text>

            <Section style={referralBox}>
              <Text style={referralLabel}>Your referral link:</Text>
              <Link href={referralLink} style={referralLinkStyle}>
                {referralLink}
              </Link>
            </Section>

            <Heading as="h2" style={subheading}>
              How it works:
            </Heading>

            <Text style={listItem}>
              <span style={bullet}>1.</span> Share your link with friends,
              classmates, or anyone who&apos;d love Agathon
            </Text>
            <Text style={listItem}>
              <span style={bullet}>2.</span> When they join the waitlist through
              your link, you get credit
            </Text>
            <Text style={listItem}>
              <span style={bullet}>3.</span> Check the{' '}
              <Link href="https://agathon.app/referral/leaderboard" style={inlineLink}>
                leaderboard
              </Link>{' '}
              to see where you rank
            </Text>
            <Text style={listItem}>
              <span style={bullet}>4.</span> Top referrers get paid — real cash,
              not credits
            </Text>

            <Text style={paragraph}>
              You can track your referrals anytime:
            </Text>

            <Link href={`https://agathon.app/referral/${referralCode}`} style={referralStatsLink}>
              View your referral stats &rarr;
            </Link>

            <Text style={paragraph} />

            <Text style={paragraph}>
              The leaderboard is live now. Go claim your spot.
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

const inlineLink: React.CSSProperties = {
  color: '#007ba5',
  textDecoration: 'underline',
};

const referralBox: React.CSSProperties = {
  backgroundColor: '#f0f9fc',
  border: '1px solid #d1ecf5',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '16px 0 24px',
};

const referralLabel: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: '600',
  color: '#666666',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '0 0 8px',
};

const referralLinkStyle: React.CSSProperties = {
  fontSize: '15px',
  fontFamily: 'monospace',
  color: '#007ba5',
  textDecoration: 'none',
  wordBreak: 'break-all' as const,
};

const referralStatsLink: React.CSSProperties = {
  fontSize: '14px',
  color: '#007ba5',
  textDecoration: 'none',
  fontWeight: '600',
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
