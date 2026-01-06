# Security Policy

We take security seriously and will address vulnerabilities promptly.

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly.

### How to Report

1. **Do NOT** create a public GitHub issue for security vulnerabilities
2. Send an email to the project maintainers with details about the vulnerability
3. Include the following information:
   - Description of the vulnerability
   - Steps to reproduce the issue
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- This is an open-source project maintained in spare time
- Reports will be reviewed and addressed as time permits
- Critical issues will be prioritized
- With your permission, you will be credited for your findings

**Note**: This software is provided "as is". Use at your own risk.

## Security Best Practices for Users

### Authentication

- Use a strong, unique password for the dashboard
- Change the default password immediately after installation
- Do not share your credentials

### Network Security

- Run the dashboard behind a reverse proxy with HTTPS in production
- Use Tailscale or similar solutions for secure remote access
- Avoid exposing the dashboard directly to the public internet
- Keep your firewall properly configured

### Phoenixd Configuration

- Protect your `seed.dat` file - it contains your wallet's seed phrase
- Regularly backup your wallet data
- Keep your `phoenix.conf` credentials secure
- Do not commit sensitive configuration files to version control

### General Recommendations

- Keep all dependencies up to date
- Use Docker for isolated deployments
- Monitor your node for unusual activity
- Enable logging and review logs regularly

## Known Security Considerations

### Environment Variables

Sensitive data is stored in environment variables. Ensure:

- `.env` files are never committed to version control
- Environment variables are properly secured in production
- Access to the server is restricted to authorized personnel

### API Authentication

- The backend uses HTTP Basic authentication for Phoenixd API
- JWT tokens are used for frontend authentication
- All API endpoints require authentication

### Data Storage

- Wallet data is stored locally in the `data/phoenixd` directory
- Database files should be protected with appropriate file permissions
- Regular backups are recommended

## Disclaimer

This software is provided "as is" without warranty of any kind. Users are responsible for:

- Securing their own installations
- Protecting their private keys and seed phrases
- Understanding the risks of running a Lightning Network node
- Maintaining proper backups

**Use at your own risk. This is financial software handling real funds.**
