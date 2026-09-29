const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

async function setup() {
  try {
    const SSH2Promise = require('ssh2-promise');

    console.log('Generating SSH keys if not present...');
    const sshDir = path.join(os.homedir(), '.ssh');
    if (!fs.existsSync(sshDir)) fs.mkdirSync(sshDir, { recursive: true });
    
    const keyPath = path.join(sshDir, 'id_rsa');
    const pubKeyPath = path.join(sshDir, 'id_rsa.pub');
    
    if (!fs.existsSync(keyPath)) {
      execSync(`ssh-keygen -t rsa -N "" -f "${keyPath}"`, { stdio: 'inherit' });
    }
    const pubKey = fs.readFileSync(pubKeyPath, 'utf8');

    console.log('Connecting to server...');
    const ssh = new SSH2Promise({
      host: '192.168.1.28',
      username: 'beasapps',
      password: 'Be@$cf34528'
    });

    await ssh.connect();
    console.log('Connected! Setting up authorized_keys...');
    
    await ssh.exec('mkdir -p ~/.ssh');
    await ssh.exec(`echo "${pubKey.trim()}" >> ~/.ssh/authorized_keys`);
    await ssh.exec('chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys');

    console.log('Setting up bare Git repository...');
    await ssh.exec('mkdir -p ~/leave-management-app.git');
    await ssh.exec('mkdir -p ~/leave-management-app');
    await ssh.exec('cd ~/leave-management-app.git && git init --bare');

    const postReceiveHook = `#!/bin/bash
TARGET="/home/beasapps/leave-management-app"
GIT_DIR="/home/beasapps/leave-management-app.git"

while read oldrev newrev ref
do
  if [[ $ref = refs/heads/main ]];
  then
    echo "==============================================="
    echo "Deploying main branch to application server..."
    echo "==============================================="
    git --work-tree=$TARGET --git-dir=$GIT_DIR checkout -f
    
    cd $TARGET
    echo "Installing backend dependencies..."
    npm install
    
    echo "Installing frontend dependencies & building..."
    cd client
    npm install
    npm run build
    cd ..
    
    echo "Restarting application via PM2..."
    pm2 restart leave-app || pm2 start server/index.js --name "leave-app"
    
    echo "==============================================="
    echo "Deployment successful!"
    echo "==============================================="
  fi
done
`;

    const envFile = `PORT=5000
DB_HOST=192.168.1.30
DB_PORT=3306
DB_USER=root
DB_PASSWORD=Be@$dev1234
DB_NAME=leave_management
JWT_SECRET=supersecretjwtkey_beas
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
`;

    console.log('Writing hooks and env file...');
    await ssh.exec(`cat << 'EOF' > ~/leave-management-app.git/hooks/post-receive\n${postReceiveHook}\nEOF`);
    await ssh.exec('chmod +x ~/leave-management-app.git/hooks/post-receive');
    
    await ssh.exec(`cat << 'EOF' > ~/leave-management-app/.env\n${envFile}\nEOF`);

    ssh.close();
    console.log('Server setup complete.');
    
    console.log('Adding local git remote...');
    try {
      execSync('git remote remove production', { stdio: 'ignore' });
    } catch(e) {}
    
    execSync('git remote add production beasapps@192.168.1.28:/home/beasapps/leave-management-app.git', { stdio: 'inherit' });
    
    console.log('Success! To deploy, just run: git push production main');

  } catch (error) {
    console.error('Error during setup:', error);
  }
}

setup();
