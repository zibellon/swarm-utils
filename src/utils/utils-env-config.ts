class ProcessENV {
  //Порт для запуска самого сервера
  public SWARM_UTILS_SERVER_PORT = 3000;

  public SWARM_UTILS_IS_CRON_BACKUP_SERVICE = true; // Делать бэкап по кроне - бэкап сервисов
  public SWARM_UTILS_IS_CRON_CLEAN_SERVICE = true; // Производить чистку кластера по кроне (SERVICES)
  public SWARM_UTILS_IS_CRON_CLEAN_NODE = true; // Производить чистку кластера по кроне (NODES)
  public SWARM_UTILS_CRON_EXPR = '* * * * *'; // Интервал работы кроны (Cron string)
  public SWARM_UTILS_ADMIN_TOKEN_LIST = ''; // Список из токенов, которае имею админ-права. =tokenA,tokenB,tokenC
  public SWARM_UTILS_DOCKER_CLI_IMAGE_NAME = 'docker:25.0.5-cli-alpine3.20'; // Название docker-cli image, который будет запускаться на каждой NODE

  // BACKUP_SERVICE_TIMEOUT
  public SWARM_UTILS_BACKUP_SERVICE_EXEC_TIMEOUT = 60_000; // 60 секунд - сколько времени на EXEC команду в момент BACKUP_SERVICE
  public SWARM_UTILS_BACKUP_SERVICE_STOP_TIMEOUT = 30_000; // 30 секунд - сколько времени на STOP команду в момент BACKUP_SERVICE
  public SWARM_UTILS_BACKUP_SERVICE_VOLUME_LIST_UPLOAD_TIMEOUT = 60_000; // 60 секунд - сколько времени на UPLOAD команду в момент BACKUP_SERVICE
  public SWARM_UTILS_BACKUP_SERVICE_START_TIMEOUT = 60_000; // 60 секунд - сколько времени на START команду в момент BACKUP_SERVICE. Только в том случае если был STOP

  // CLEAN_SERVICE_TIMEOUT
  public SWARM_UTILS_CLEAN_SERVICE_EXEC_TIMEOUT = 30_000; // 30 секунд - сколько времени на EXEC команду в момент CLEAN_SERVICE

  // UPDATE_SERVICE_TIMEOUT
  public SWARM_UTILS_UPDATE_SERVICE_TIMEOUT = 30_000; // 30 секунд - сколько времени на UPDATE_SERVICE

  // CLEAN_SERVICE_TIMEOUT
  public SWARM_UTILS_CLEAN_NODE_IMAGE_TIMEOUT = 30_000; // 30 секунд - сколько времени на IMAGE PRUNE команду в момент CLEAN_NODE
  public SWARM_UTILS_CLEAN_NODE_BUILDER_TIMEOUT = 30_000; // 30 секунд - сколько времени на BUILDER PRUNE команду в момент CLEAN_NODE
  public SWARM_UTILS_CLEAN_NODE_CONTAINER_TIMEOUT = 30_000; // 30 секунд - сколько времени на CONTAINER PRUNE команду в момент CLEAN_NODE

  // Timeouts - общие
  public SWARM_UTILS_PENDING_SERVICE_TIMEOUT = 20_000; // 20 секунд - сколько времени на запуск сервиса
  public SWARM_UTILS_LOCK_TIMEOUT = 10_000; // 10 секунд - сколько времени на уствновку блокировки
  public SWARM_UTILS_EXTRA_TIMEOUT = 10_000; // 10 секунд - сколько времени на уствновку блокировки

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
    if (typeof process.env.SWARM_UTILS_IS_CRON_BACKUP_SERVICE === 'string') {
      processENV.SWARM_UTILS_IS_CRON_BACKUP_SERVICE = process.env.SWARM_UTILS_IS_CRON_BACKUP_SERVICE === 'true';
    }
    if (typeof process.env.SWARM_UTILS_IS_CRON_CLEAN_SERVICE === 'string') {
      processENV.SWARM_UTILS_IS_CRON_CLEAN_SERVICE = process.env.SWARM_UTILS_IS_CRON_CLEAN_SERVICE === 'true';
    }
    if (typeof process.env.SWARM_UTILS_IS_CRON_CLEAN_NODE === 'string') {
      processENV.SWARM_UTILS_IS_CRON_CLEAN_NODE = process.env.SWARM_UTILS_IS_CRON_CLEAN_NODE === 'true';
    }
    if (typeof process.env.SWARM_UTILS_CRON_EXPR === 'string') {
      processENV.SWARM_UTILS_CRON_EXPR = process.env.SWARM_UTILS_CRON_EXPR;
    }
    if (typeof process.env.SWARM_UTILS_ADMIN_TOKEN_LIST === 'string') {
      processENV.SWARM_UTILS_ADMIN_TOKEN_LIST = process.env.SWARM_UTILS_ADMIN_TOKEN_LIST;
    }
    if (typeof process.env.SWARM_UTILS_DOCKER_CLI_IMAGE_NAME === 'string') {
      processENV.SWARM_UTILS_DOCKER_CLI_IMAGE_NAME = process.env.SWARM_UTILS_DOCKER_CLI_IMAGE_NAME;
    }

    // Timeouts
    //
    if (typeof process.env.SWARM_UTILS_BACKUP_SERVICE_EXEC_TIMEOUT === 'string') {
      processENV.SWARM_UTILS_BACKUP_SERVICE_EXEC_TIMEOUT = Number(process.env.SWARM_UTILS_BACKUP_SERVICE_EXEC_TIMEOUT);
    }
    if (typeof process.env.SWARM_UTILS_BACKUP_SERVICE_STOP_TIMEOUT === 'string') {
      processENV.SWARM_UTILS_BACKUP_SERVICE_STOP_TIMEOUT = Number(process.env.SWARM_UTILS_BACKUP_SERVICE_STOP_TIMEOUT);
    }
    if (typeof process.env.SWARM_UTILS_BACKUP_SERVICE_VOLUME_LIST_UPLOAD_TIMEOUT === 'string') {
      processENV.SWARM_UTILS_BACKUP_SERVICE_VOLUME_LIST_UPLOAD_TIMEOUT = Number(
        process.env.SWARM_UTILS_BACKUP_SERVICE_VOLUME_LIST_UPLOAD_TIMEOUT
      );
    }
    if (typeof process.env.SWARM_UTILS_BACKUP_SERVICE_START_TIMEOUT === 'string') {
      processENV.SWARM_UTILS_BACKUP_SERVICE_START_TIMEOUT = Number(
        process.env.SWARM_UTILS_BACKUP_SERVICE_START_TIMEOUT
      );
    }
    //
    if (typeof process.env.SWARM_UTILS_CLEAN_SERVICE_EXEC_TIMEOUT === 'string') {
      processENV.SWARM_UTILS_CLEAN_SERVICE_EXEC_TIMEOUT = Number(process.env.SWARM_UTILS_CLEAN_SERVICE_EXEC_TIMEOUT);
    }
    //
    if (typeof process.env.SWARM_UTILS_UPDATE_SERVICE_TIMEOUT === 'string') {
      processENV.SWARM_UTILS_UPDATE_SERVICE_TIMEOUT = Number(process.env.SWARM_UTILS_UPDATE_SERVICE_TIMEOUT);
    }
    //
    if (typeof process.env.SWARM_UTILS_CLEAN_NODE_IMAGE_TIMEOUT === 'string') {
      processENV.SWARM_UTILS_CLEAN_NODE_IMAGE_TIMEOUT = Number(process.env.SWARM_UTILS_CLEAN_NODE_IMAGE_TIMEOUT);
    }
    if (typeof process.env.SWARM_UTILS_CLEAN_NODE_BUILDER_TIMEOUT === 'string') {
      processENV.SWARM_UTILS_CLEAN_NODE_BUILDER_TIMEOUT = Number(process.env.SWARM_UTILS_CLEAN_NODE_BUILDER_TIMEOUT);
    }
    if (typeof process.env.SWARM_UTILS_CLEAN_NODE_CONTAINER_TIMEOUT === 'string') {
      processENV.SWARM_UTILS_CLEAN_NODE_CONTAINER_TIMEOUT = Number(
        process.env.SWARM_UTILS_CLEAN_NODE_CONTAINER_TIMEOUT
      );
    }
    //
    if (typeof process.env.SWARM_UTILS_PENDING_SERVICE_TIMEOUT === 'string') {
      processENV.SWARM_UTILS_PENDING_SERVICE_TIMEOUT = Number(process.env.SWARM_UTILS_PENDING_SERVICE_TIMEOUT);
    }
    if (typeof process.env.SWARM_UTILS_LOCK_TIMEOUT === 'string') {
      processENV.SWARM_UTILS_LOCK_TIMEOUT = Number(process.env.SWARM_UTILS_LOCK_TIMEOUT);
    }
    if (typeof process.env.SWARM_UTILS_EXTRA_TIMEOUT === 'string') {
      processENV.SWARM_UTILS_EXTRA_TIMEOUT = Number(process.env.SWARM_UTILS_EXTRA_TIMEOUT);
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
