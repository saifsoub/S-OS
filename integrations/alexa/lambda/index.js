const Alexa = require('ask-sdk-core');

const OWNER = process.env.GITHUB_OWNER || 'saifsoub';
const REPO = process.env.GITHUB_REPO || 'S-OS';

async function github(path, options = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is not configured');
  const response = await fetch('https://api.github.com' + path, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (!response.ok) throw new Error('GitHub API error ' + response.status);
  return response.status === 204 ? {} : response.json();
}

const Launch = {
  canHandle(h) { return Alexa.getRequestType(h.requestEnvelope) === 'LaunchRequest'; },
  handle(h) { return h.responseBuilder.speak('S Home GitHub is ready.').reprompt('What should I do on GitHub?').getResponse(); }
};

const CreateIssue = {
  canHandle(h) { return Alexa.getIntentName(h.requestEnvelope) === 'CreateIssueIntent'; },
  async handle(h) {
    const title = h.requestEnvelope.request.intent.slots?.title?.value || 'Alexa request';
    const issue = await github(`/repos/${OWNER}/${REPO}/issues`, {method:'POST', body:JSON.stringify({title})});
    return h.responseBuilder.speak(`Created issue ${issue.number} in ${REPO}.`).getResponse();
  }
};

const RepoStatus = {
  canHandle(h) { return Alexa.getIntentName(h.requestEnvelope) === 'RepoStatusIntent'; },
  async handle(h) {
    const repo = await github(`/repos/${OWNER}/${REPO}`);
    return h.responseBuilder.speak(`${REPO} is available. Default branch is ${repo.default_branch}.`).getResponse();
  }
};

const LatestBuild = {
  canHandle(h) { return Alexa.getIntentName(h.requestEnvelope) === 'LatestBuildIntent'; },
  async handle(h) {
    const data = await github(`/repos/${OWNER}/${REPO}/actions/runs?per_page=1`);
    const run = data.workflow_runs?.[0];
    const speech = run ? `Latest workflow is ${run.status}. Result is ${run.conclusion || 'pending'}.` : 'No workflow runs found.';
    return h.responseBuilder.speak(speech).getResponse();
  }
};

const Help = {canHandle:h=>Alexa.getIntentName(h.requestEnvelope)==='AMAZON.HelpIntent',handle:h=>h.responseBuilder.speak('You can ask me to create an issue, check the repository, or read the latest workflow.').getResponse()};
const Stop = {canHandle:h=>['AMAZON.StopIntent','AMAZON.CancelIntent'].includes(Alexa.getIntentName(h.requestEnvelope)),handle:h=>h.responseBuilder.speak('Goodbye.').getResponse()};
const Errors = {canHandle:()=>true,handle:(h,e)=>h.responseBuilder.speak('The GitHub command could not be completed.').getResponse()};

exports.handler = Alexa.SkillBuilders.custom().addRequestHandlers(Launch,CreateIssue,RepoStatus,LatestBuild,Help,Stop).addErrorHandlers(Errors).lambda();
