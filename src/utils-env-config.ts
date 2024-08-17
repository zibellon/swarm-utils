class ProcessENV {
  //Порт для запуска самого сервера
  public SWARM_UTILS_SERVER_PORT = 3000;

  public SWARM_UTILS_IS_CRON_BACKUP = true; // Делать бэкап по кроне
  public SWARM_UTILS_IS_CRON_CLEAN = true; // Производить чистку кластера по кроне
  public SWARM_UTILS_CRON_EXPR = '* * * * *'; // Интервал работы кроны (Cron string)
  public SWARM_UTILS_ADMIN_TOKEN_LIST = ''; // Список из токенов, которае имею админ-права. =tokenA,tokenB,tokenC
  public SWARM_UTILS_DOCKER_CLI_VERSION = '25.0.5-cli-alpine3.20'; // Версия docker-cli контейнера, который будет запускаться на каждой NODE

  public SWARM_UTILS_LOCK_TIMEOUT = 10_000; // 10 секунд - сколько времени на уствновку блокировки
  public SWARM_UTILS_LOCK_MAX_OCCUPATION_TIME = 630_000; // 10 минут 30 сек - сколько суммарно времени
  public SWARM_UTILS_LOCK_MAX_EXECUTION_TIME = 600_000; // 10 минут - сколько может выполняться BASH script

  // S3 (offen-backup)
  public SWARM_UTILS_S3_DOMAIN = 's3-api.domain.com'; // Доменное имя где находится облако S3
  public SWARM_UTILS_S3_HTTPS = true; // Использовать HTTPS или нет. Если нет - подключение будет идти через http://
  public SWARM_UTILS_S3_BUCKET_NAME = 'my-bucket-name'; // Название bucket - куда заливать бэкап
  public SWARM_UTILS_S3_ACCESS_KEY = '...'; // Ключ для доступа к S3
  public SWARM_UTILS_S3_SECRET_ACCESS_KEY = '...'; // Секрет для доступа к S3

  // REGISTRY
  public SWARM_UTILS_REGISTRY_USER = ''; // Имя пользователя, для доступа к регистри
  public SWARM_UTILS_REGISTRY_PASSWORD = ''; // password от регистри. Если это GitLab - можно использовать токен с парвами на чтение/запись в регистри
  public SWARM_UTILS_REGISTRY_URL = ''; // url регистри. Обязательно используется HTTPS. domain.com
}

let processENV: ProcessENV | null = null;

export function getProcessEnv(): ProcessENV {
  if (processENV === null) {
    processENV = new ProcessENV();

    //MAIN
    if (typeof process.env.SWARM_UTILS_SERVER_PORT === 'string') {
      processENV.SWARM_UTILS_SERVER_PORT = Number(process.env.SWARM_UTILS_SERVER_PORT);
    }
    if (typeof process.env.SWARM_UTILS_IS_CRON_BACKUP === 'string') {
      processENV.SWARM_UTILS_IS_CRON_BACKUP = process.env.SWARM_UTILS_IS_CRON_BACKUP === 'true';
    }
    if (typeof process.env.SWARM_UTILS_IS_CRON_CLEAN === 'string') {
      processENV.SWARM_UTILS_IS_CRON_CLEAN = process.env.SWARM_UTILS_IS_CRON_CLEAN === 'true';
    }
    if (typeof process.env.SWARM_UTILS_CRON_EXPR === 'string') {
      processENV.SWARM_UTILS_CRON_EXPR = process.env.SWARM_UTILS_CRON_EXPR;
    }
    if (typeof process.env.SWARM_UTILS_ADMIN_TOKEN_LIST === 'string') {
      processENV.SWARM_UTILS_ADMIN_TOKEN_LIST = process.env.SWARM_UTILS_ADMIN_TOKEN_LIST;
    }
    if (typeof process.env.SWARM_UTILS_DOCKER_CLI_VERSION === 'string') {
      processENV.SWARM_UTILS_DOCKER_CLI_VERSION = process.env.SWARM_UTILS_DOCKER_CLI_VERSION;
    }

    // LOCK
    if (typeof process.env.SWARM_UTILS_LOCK_TIMEOUT === 'string') {
      processENV.SWARM_UTILS_LOCK_TIMEOUT = Number(process.env.SWARM_UTILS_LOCK_TIMEOUT);
    }
    if (typeof process.env.SWARM_UTILS_LOCK_MAX_OCCUPATION_TIME === 'string') {
      processENV.SWARM_UTILS_LOCK_MAX_OCCUPATION_TIME = Number(process.env.SWARM_UTILS_LOCK_MAX_OCCUPATION_TIME);
    }
    if (typeof process.env.SWARM_UTILS_LOCK_MAX_EXECUTION_TIME === 'string') {
      processENV.SWARM_UTILS_LOCK_MAX_EXECUTION_TIME = Number(process.env.SWARM_UTILS_LOCK_MAX_EXECUTION_TIME);
    }

    //S3
    if (typeof process.env.SWARM_UTILS_S3_DOMAIN === 'string') {
      processENV.SWARM_UTILS_S3_DOMAIN = process.env.SWARM_UTILS_S3_DOMAIN;
    }
    if (typeof process.env.SWARM_UTILS_S3_HTTPS === 'string') {
      processENV.SWARM_UTILS_S3_HTTPS = process.env.SWARM_UTILS_S3_HTTPS === 'true';
    }
    if (typeof process.env.SWARM_UTILS_S3_BUCKET_NAME === 'string') {
      processENV.SWARM_UTILS_S3_BUCKET_NAME = process.env.SWARM_UTILS_S3_BUCKET_NAME;
    }
    if (typeof process.env.SWARM_UTILS_S3_ACCESS_KEY === 'string') {
      processENV.SWARM_UTILS_S3_ACCESS_KEY = process.env.SWARM_UTILS_S3_ACCESS_KEY;
    }
    if (typeof process.env.SWARM_UTILS_S3_SECRET_ACCESS_KEY === 'string') {
      processENV.SWARM_UTILS_S3_SECRET_ACCESS_KEY = process.env.SWARM_UTILS_S3_SECRET_ACCESS_KEY;
    }

    // REGISTRY
    if (typeof process.env.SWARM_UTILS_REGISTRY_USER === 'string') {
      processENV.SWARM_UTILS_REGISTRY_USER = process.env.SWARM_UTILS_REGISTRY_USER;
    }
    if (typeof process.env.SWARM_UTILS_REGISTRY_PASSWORD === 'string') {
      processENV.SWARM_UTILS_REGISTRY_PASSWORD = process.env.SWARM_UTILS_REGISTRY_PASSWORD;
    }
    if (typeof process.env.SWARM_UTILS_REGISTRY_URL === 'string') {
      processENV.SWARM_UTILS_REGISTRY_URL = process.env.SWARM_UTILS_REGISTRY_URL;
    }
  }
  return processENV;
}
