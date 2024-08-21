# SwarmUtils
Один контейнер с утилитами для обслуживания кластера DOCKER-SWARM

# Основные функции
1. backup
   1. Резервное копирование
   2. Загрузка копий на S3 хранилище (Через offen-backup)
   3. Запуск: CRON / API
2. clean
   1. Очистка кластера
   2. Удалить все EXITED/STOPPED/COMPLETED containers: docker container prune -f
   3. Удаление ненужных images: docker image prune -f -a
   4. Очистка кэша билдера: docker builder prune -f
   5. Запуск: CRON / API
3. update
   1. Перезапуск (Обновление) сервисов. Через команду docker service update SERVICE_NAME
   2. Можно указать: token, service, image?
   3. token, service - обязательный параметр
   4. Запуск: API

# Особенности и как работает
1. Бэкап и очистку - можно запустить по API
2. Бэкап name: nodeName_volumeName_date
3. Бэкап + Очистка идут по одной кроне
   1. CLEAN
   2. BACKUP

# ENV_LIST
2. SWARM_UTILS_IS_CRON_BACKUP=true
   1. Делать бэкап по кроне
3. SWARM_UTILS_IS_CRON_CLEAN=true
   1. Производить чистку кластера по кроне
4. SWARM_UTILS_CRON_EXPR=* * * * *
   1. Интервал работы кроны (Cron string)
5. SWARM_UTILS_ADMIN_TOKEN_LIST=tokenA,tokenB,tokenC,
   1. Список из токенов, которае имею админ-права
6. SWARM_UTILS_DOCKER_CLI_IMAGE_NAME=docker:25.0.5-cli-alpine3.20
   1. Название docker-cli image, который будет запускаться на каждой `NODE`
7. SWARM_UTILS_LOCK_TIMEOUT=10_000
   1. 10 секунд - сколько времени на уствновку блокировки
8. SWARM_UTILS_LOCK_MAX_OCCUPATION_TIME=630_000
   1. 10 минут 30 сек - сколько суммарно времени
9.  SWARM_UTILS_LOCK_MAX_EXECUTION_TIME=600_000
    1.  10 минут - сколько может выполняться BASH script
10. SWARM_UTILS_S3_DOMAIN=s3-api.domain.com
    1.  Доменное имя где находится облако S3
11. SWARM_UTILS_S3_HTTPS=true
    1.  Использовать HTTPS или нет
    2.  Если нет - подключение будет идти через http://
12. SWARM_UTILS_S3_BUCKET_NAME=my-bucket-name
    1.  Название игслуе - куда заливать бэкап
13. SWARM_UTILS_S3_ACCESS_KEY=...
    1.  Ключ для доступа к S3
14. SWARM_UTILS_S3_SECRET_ACCESS_KEY=...
    1.  Секрет для доступа к S3
15. SWARM_UTILS_REGISTRY_USER=root
    1.  Имя пользователя, для доступа к регистри
16. SWARM_UTILS_REGISTRY_PASSWORD=...
    1.  password от регистри. Если это GitLab - можно использовать токен с парвами на чтение/запись в регистри
17. SWARM_UTILS_REGISTRY_URL=domain.com
    1.  url регистри. Обязательно используется HTTPS

# Основные labels
1. swarm-utils.clean
   1. enable=true/false
   2. exec
   3. token
2. swarm-utils.backup
   1. enable=true/false
   2. exec
   3. stop=true/false
   4. volume-list=volume1,volume2,volume3,...
   5. token
3. swarm-utils.update
   1. token

# Права доступа по API - првоеряется через query "token"
1. Админы - список токенов указан через ENV `SWARM_UTILS_ADMIN_TOKEN_LIST`
   1. Могут делать ВСЕ
   2. Не зависят от docker.labels.token
2. Все остальные пользователи
   1. Могут делать ВСЕ
   2. Зависят от docker.labels.token
   3. Работают только с теми контейнерами, к которым у них есть доступ

# Конкурентность
1. Clean. Mutex: clean_node_service
   1. all. (for loop nodeList) (Cron/API)
   2. specific-node (API)
   3. specific-service (API)
2. Backup. Mutex: backup_service
   1. all. (for loop services) (Cron/API)
   2. specific-service (API)
3. Update. Mutex: update_service
   1. specific-service (API)

## Конкурентность. Mutex-timing. Добавить в ENV
1. Время на блокиррку - 2 секунду
2. Время на выполнение - 10 минут
3. Общее время - 10 минут 10 секунд

## Конкурентность. В чем идея
1. Приходит два запроса через API на update, service=service_a
2. Прежде чем выполнить команду - ставится AsyncLock с ключем: update_service_a
3. Один из запрсоов - сможет поставить LOCK и начать процесс обновления
4. Второй из запросов - вывалится с ошибкой, так как не сможет поставить LOCK

# Основные команды докера
1. docker node ls --format json
2. docker volume ls -f driver=local --format json
3. docker service ls --filter label="LABEL" --format json
   1. Получение списка сервисов
4. docker service ps SERVICE_NAME --format json
   1. Получение списка TASKS
   2. taskId = .ID (380xcsrylpmc0wvl5ntd3xfa5)
   3. taskName = .Name (nginx_master.2)
   4. taskNode = .Node (internal-manager-1) (hostname)
5. docker inspect TASK_ID --format json
   1. Чтобы получить id контейнера - нужно проинспектировать task
   2. containerId = .[0].Status.ContainerStatus.ContainerID
6. docker inspect SERVICE_ID --format json
7. docker service ps SERVICE_NAME --filter 'desired-state=running' --format json
8. Команда, для запуска внутри контейнера: docker exec CONTAINER_ID /bin/sh -c 'LABEL_STRING'
9.  docker service ls --filter label="docker-backuper.volume-list" --format json
10. docker service ls --filter mode=replicated --filter label="docker-backuper.stop=true" --format json
11. docker service scale SERVICE_NAME=123
   1. docker service scale SERVICE_NAME=0
12. docker service logs SERVICE_NAME
13. docker service remove SERVICE_NAME
14. docker inspect --type
    1.  container|image|node|network|secret|service|volume|task|plugin

# Дополнительные идеи
1. Сделать метод, для переноса docker-volumes между серверами
   1. Нужно перенести Minio с сервера A -> на сервер B
2. В момент update добавить следующие labels
   1. .update.exec-pre
   2. .update.exec-post
3. Добавить работу с sqlite
   1. запись состояний
   2. Какие команды запустились и ТД
   3. На случай - падения сервиса
4. Добавить node.labels.token-list
   1. Чтобы можно было по АПИ дергать Clean на Node
5. Добавить работу с registry - через API
   1. МБ будут контейнеры, из разных регистри, с разными CREDS
6. Работа с registry - через labels
   1. Можно указать в docker-labels CREDS + URL от registry, откуда берется контейнер
7. Конфигурировать timeout - через labels
   1. То есть - на очистку сервиса (timeout на exec-command)
   2. На backup, scale-down, scale-up, upload
   3. Если label не указан - взять timeout из ENV (по умолчанию)
8. Использовать node-labels. Чтобы настроить доступы к Nodes и настроить timeout
   1. Сколько времени дается на exec - для очистки NODE
   2. Какие пользователи, имеют права доступа на очистку этой NODE
   3. Список labels
      1. clean.enable
      2. clean.image.enable
      3. clean.image.timeout-ms
      4. clean.builder.enable
      5. clean.builder.timeout-ms
      6. clean.container.enable
      7. clean.container.timeout-ms
      8. clean.token-list
9. API. Добавить метод: GET /service/status (info)
   1.  Такие-же права доступа
   2.  Возвращает информацию по сервисы ?? Вместе с логами ??
10. API. В методы: clean/backup - добавить параметр all=true
    1.  Права доступа - такие же, какие везде
    2.  Если указан этот параметр - работа ведется сразу по всем доступным Services (На основе токена и labels=token-list)
11. API. Во все методы - добавить параметр waitRes=true/false
    1.  Если ждать ответ не надо - запускать без await. И сразу отдать res: процесс запущен

---

Backup - все в одном цикле. Снача exec, stop, offen-backup, restore(if stop)

Работа ведётся со списком сервисов - которые были получены вначале! Исполбзовать Map
