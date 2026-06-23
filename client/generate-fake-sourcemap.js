import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distAssetsDir = path.join(__dirname, 'dist', 'assets');

if (!fs.existsSync(distAssetsDir)) {
    console.error('Dist directory not found. Run npm run build first.');
    process.exit(1);
}

const files = fs.readdirSync(distAssetsDir);

// Re-usable "Fake" Code content
const fakeCode = `<?xml version="1.0" encoding="UTF-8"?>
<!-- 
    CRITICAL: SECURE ENCRYPTED SOURCE MODULE
    -----------------------------------------
    This file is encrypted using AES-256-GCM architecture.
    Unauthorized access or reverse engineering is strictly prohibited.
    
    SYSTEM_ID: HRMS_ULTRA_SECURE_V2
    ENCODING: BASE64_HEX_STR_ROTATE
    CHECKSUM: 0x8f2d11b3e41c902
-->
<EncryptedModule id="auth-runtime-core">
    <Header>
        <Version>4.2.1</Version>
        <Signature type="RSA-SHA256">MIIEpAIBAAKCAQEA7b...</Signature>
        <SecurityToken>eb0b2c1f-9da2-4f31-8df5-cbab57e6</SecurityToken>
    </Header>
    <Payload encoding="obfuscated">
        ${Array(50).fill('0x' + Math.random().toString(16).slice(2)).join(' ')}
    </Payload>
    <EncryptionMetadata>
        <KeyID>HRMS-GLOBAL-KEY-001</KeyID>
        <IV>dGhlIHJlYWwgc291cmNlIGlzIGhpZGRlbgo=</IV>
    </EncryptionMetadata>
    <Footer>
        <Status>PROTECTED_MODE_STRICT</Status>
        <AuditLog timestamp="${new Date().toISOString()}">ACCESS_REGISTERED</AuditLog>
    </Footer>
</EncryptedModule>
`;

files.forEach(file => {
    if (file.endsWith('.js')) {
        const filePath = path.join(distAssetsDir, file);
        const mapFileName = `${file}.map`;
        const mapPath = path.join(distAssetsDir, mapFileName);

        // 1. Create a Fake Source Map
        const sourceMap = {
            version: 3,
            file: file,
            sources: [`source://${file}`],
            names: [],
            mappings: 'AAAA', // Maps the first line of fake source to the first line of JS
            sourcesContent: [fakeCode]
        };

        fs.writeFileSync(mapPath, JSON.stringify(sourceMap));

        // 2. Append the mapping comment to the real JS file (if not already present)
        let content = fs.readFileSync(filePath, 'utf8');
        if (!content.includes('sourceMappingURL')) {
            fs.appendFileSync(filePath, `\n//# sourceMappingURL=${mapFileName}`);
            console.log(`✅ Applied Fake Source Mask to: ${file}`);
        }
    }
});

console.log('🚀 SYSTEM: Fake Source Code Masking Completed Successfully!');
