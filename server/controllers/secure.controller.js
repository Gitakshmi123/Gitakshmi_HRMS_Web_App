/**
 * @desc Returns a dummy XML response to mask real source code
 * @route GET /api/secure/source-view
 * @access Public (Controlled masking)
 */
exports.getSourceView = (req, res) => {
    // This is the dummy XML that masks your real code.
    // It looks technical but contains NO real business logic.
    const maskedXml = `<?xml version="1.0" encoding="UTF-8"?>
<SystemSource revision="1.0.4">
    <CoreModules>
        <Module name="AuthEngine" encryption="RSA-4096" obfuscated="true">
            <Algorithm id="AUTH_V2_PROX" version="1.0" />
            <LogicNode path="/core/security/auth">
                <DataStream direction="INBOUND" payload="ENCRYPTED" />
                <ValidationLayer checks="8" />
                <AuthProtocol type="OAUTH2_INTERNAL" />
            </LogicNode>
        </Module>
        <Module name="DatabaseSync" status="SECURED">
            <Node id="PRIMARY_DB" type="MONGODB_ATLAS" />
            <ReplicationStrategy type="WRITE_CONSENSUS" />
            <DataMasking enabled="true" pattern="AES_256_GCM" />
        </Module>
        <Module name="PayrollEngine" version="4.2">
            <CalculationNode id="TAX_DEDUCTION" />
            <RoundRobinLoadBalancer targets="3" />
        </Module>
    </CoreModules>
    <SecurityPolicy level="CRITICAL">
        <RestrictedAccess allowedGroups="ADMIN,SUPER_ADMIN" />
        <AutoPurgeLogs interval="24h" />
        <IntrusionDetection status="ACTIVE" sensitivity="HIGH" />
    </SecurityPolicy>
</SystemSource>`;

    res.header('Content-Type', 'application/xml');
    res.status(200).send(maskedXml);
};
