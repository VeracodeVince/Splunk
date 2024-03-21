const express = require('express');
const bodyParser = require('body-parser');
const { sendEvent, flush } = require('splunk-logging').Logger;
const axios = require('axios');

const app = express();

app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send('Veracode Splunk Import');
});

app.post('/veracode', async (req, res) => {
  const { veracode_project_id, veracode_build_id } = req.body;
  const baseUrl = `https://api.veracode.com/was/rest/5.0/${veracode_project_id}/builds/${veracode_build_id}/details`;
  const headers = { 'x-api-key': process.env.VERACODE_API_KEY };

  const { data } = await axios.get(baseUrl, { headers });
  const { issues, build_id: buildId } = data;
  const events = issues.map(issue => {
    const {
      category,
      cwe,
      severity,
      sourcefile,
      sourceline,
      type,
      name,
    } = issue.finding;
    const policyName = issue.policy_name;
    const vulnId = issue.issue_id;
    return {
      source: 'veracode',
      sourcetype: 'veracode:build',
      event: {
        build_id: buildId,
        category,
        cwe,
        severity,
        sourcefile,
        sourceline,
        type,
        policy_name: policyName,
        name,
        vuln_id: vulnId,
      },
    };
  });

  const promises = events.map(event => sendEvent(event));
  await Promise.all(promises);

  await flush();

  res.sendStatus(200);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});

