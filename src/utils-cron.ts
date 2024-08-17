import { CronJob } from "cron";
import { getProcessEnv } from "./utils-env-config";
import { dockerNodeLs } from "./utils-docker-api";

let isCronProgress = false;

export async function initCron() {
  const cronJob = new CronJob(getProcessEnv().SWARM_UTILS_CRON_EXPR, async () => {
    const dateCron = new Date();

    if (isCronProgress === false) {
      isCronProgress = true;



    }
  });

  cronJob.start();
}

// execServiceName="docker_backuper_exec"
// execCommand="docker exec $containerId /bin/sh -c '$execLabel'"

// docker service create \
//   --detach \
//   --name $execServiceName \
//   --mode replicated \
//   --replicas 1 \
//   --constraint node.hostname==$taskNode \
//   --restart-condition none \
//   --mount type=bind,source=/var/run/docker.sock,destination=/var/run/docker.sock,readonly \
//   docker:25.0.5-cli-alpine3.20 sh -c "$execCommand"

// # While loop here
// waitForServiceComplete $execServiceName

// docker service logs $execServiceName
// docker service remove $execServiceName

async function cronCleanProgress(dateCron: Date) {

  // Очистка Node
  const nodeList = await dockerNodeLs();

  for (const node of nodeList) {
    
  }


}

async function cronBackupProgress(dateCron: Date) {
  
}