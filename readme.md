# SwarmUtils
Один контейнер с утилитами для обслуживания кластера DOCKER-SWARM

# Основные функции
1. clean-node
   1. Удалить все EXITED/STOPPED/COMPLETED containers: docker container prune -f
   2. Удаление ненужных images: docker image prune -f -a
   3. Очистка кэша билдера: docker builder prune -f
   4. Запуск: CRON
2. backup-service
   1. Резервное копирование
   2. Работает только на service
   3. Загрузка копий на S3 хранилище (Через [offen-backup](https://github.com/offen/docker-volume-backup))
   4. Запуск: CRON / API
3. clean-service
   1. Очистка одного или нескольких сервисов. (Например - registry, smtp cache)
   2. Параметры API запроса
      1. token - обязательный параметр
      2. serviceName - обязательный параметр (stack-name_service-name)
   3. Запуск: CRON / API
4. update-service
   1. Перезапуск (Обновление) сервисов. Через команду docker service update SERVICE_NAME
   2. Можно указать: serviceName, image?
   3. Параметры API запроса
      1. token - обязательный параметр
      2. serviceName - обязательный параметр (stack-name_service-name)
      3. image - необязательный параметр. Полное название image. image-name:tag
      4. isRegistryAuthBody - необязательный параметр. true/false
         1. На данный момент - зависит от ENV переменных SWARM_UTILS_REGISTRY_*
   4. Запуск: API

# ENV_LIST
2. SWARM_UTILS_IS_CRON_BACKUP_SERVICE=true
   1. Делать бэкап по кроне - бэкап сервисов
3. SWARM_UTILS_IS_CRON_CLEAN_SERVICE=true
   1. Производить чистку кластера по кроне (SERVICES)
4. SWARM_UTILS_IS_CRON_CLEAN_NODE=true
   1. Производить чистку кластера по кроне (NODES)
5. SWARM_UTILS_CRON_EXPR=* * * * *
   1. Интервал работы кроны (Cron string)
6. SWARM_UTILS_ADMIN_TOKEN_LIST=tokenA,tokenB,tokenC,
   1. Список из токенов, которае имею админ-права
7. SWARM_UTILS_DOCKER_CLI_IMAGE_NAME=docker:25.0.5-cli-alpine3.20
   1. Название docker-cli image, который будет запускаться на каждой `NODE`
8. SWARM_UTILS_BACKUP_SERVICE_EXEC_TIMEOUT
   1. Сколько времени на EXEC команду в момент BACKUP_SERVICE
9.  SWARM_UTILS_BACKUP_SERVICE_STOP_TIMEOUT
   1. Сколько времени на STOP команду в момент BACKUP_SERVICE
10. SWARM_UTILS_BACKUP_SERVICE_VOLUME_LIST_UPLOAD_TIMEOUT
    1.  Сколько времени на UPLOAD команду в момент BACKUP_SERVICE
11. SWARM_UTILS_BACKUP_SERVICE_START_TIMEOUT
    1.  Сколько времени на START команду в момент BACKUP_SERVICE. Только в том случае если был STOP
12. SWARM_UTILS_CLEAN_SERVICE_EXEC_TIMEOUT
    1.  Сколько времени на EXEC команду в момент CLEAN_SERVICE
13. SWARM_UTILS_UPDATE_SERVICE_TIMEOUT
    1.  Сколько времени на UPDATE_SERVICE
14. SWARM_UTILS_CLEAN_NODE_IMAGE_TIMEOUT
    1.  Сколько времени на IMAGE PRUNE команду в момент CLEAN_NODE
15. SWARM_UTILS_CLEAN_NODE_BUILDER_TIMEOUT
    1.  Сколько времени на BUILDER PRUNE команду в момент CLEAN_NODE
16. SWARM_UTILS_CLEAN_NODE_CONTAINER_TIMEOUT
    1.  Сколько времени на CONTAINER PRUNE команду в момент CLEAN_NODE
17. SWARM_UTILS_LOCK_TIMEOUT=10_000
   1. 10 секунд - сколько времени на уствновку блокировки
18. SWARM_UTILS_EXTRA_TIMEOUT=10_000
    1.  Дополнительное время для блокировки. Задержки сети и ТД
19. SWARM_UTILS_S3_DOMAIN=s3-api.domain.com
    1.  Доменное имя где находится облако S3
20. SWARM_UTILS_S3_HTTPS=true
    1.  Использовать HTTPS или нет. Если нет - подключение будет идти через http://
21. SWARM_UTILS_S3_BUCKET_NAME=my-bucket-name
    1.  Название игслуе - куда заливать бэкап
22. SWARM_UTILS_S3_ACCESS_KEY=...
    1.  Ключ для доступа к S3
23. SWARM_UTILS_S3_SECRET_ACCESS_KEY=...
    1.  Секрет для доступа к S3
24. SWARM_UTILS_S3_BACKUP_RETENTION_DAYS=5
    1.  Сколько времени живет каждый бэкап в S3
25. SWARM_UTILS_REGISTRY_USER=root
    1.  Имя пользователя, для доступа к регистри
26. SWARM_UTILS_REGISTRY_PASSWORD=...
    1.  password от регистри. Если это GitLab - можно использовать токен с парвами на чтение/запись в регистри
27. SWARM_UTILS_REGISTRY_URL=domain.com
    1.  url регистри. Обязательно используется HTTPS

# Список LABELS
## Для SERVICE
1. swarm-utils.clean
   1. enable=true/false
   2. exec
   3. token
2. swarm-utils.backup
   1. enable=true/false
   2. exec
   3. stop=true/false
   4. volume-list-upload=volume1,volume2,volume3,...
   5. token
3. swarm-utils.update
   1. enable=true/false
   2. token

## Для NODE
1. swarm-utils.clean
   1. enable=true/false
   2. exec
   3. token
2. swarm-utils.backup
   1. enable=true/false
   2. exec
   3. volume-list-upload=volume1,volume2,volume3,...
   4. token

# Права доступа по API - првоеряется через query "token"
1. Админы. Cписок токенов указан через ENV `SWARM_UTILS_ADMIN_TOKEN_LIST`
   1. Могут делать ВСЕ
   2. Не зависят от `labels.token`
2. Все остальные пользователи
   1. Могут делать ВСЕ
   2. Зависят от `labels.token`
   3. Работают только с теми контейнерами, к которым у них есть доступ

# Особенности и как работает
1. Бэкап и очистку - можно запустить по API
2. Бэкап name: nodeName_volumeName_date
3. Бэкап + Очистка идут по одной кроне
   1. CLEAN
   2. BACKUP

# Конкурентность
## Ситуация (1)
1. Через API запустили clean-service - service_A
2. Запустился процесс. Процесс займет условно 30 секунд
3. Через 5 секунд - стартует CRON для очситки всех сервисов
4. И запускает очситку на service_A
5. Итог: НЕИЗВЕСТНО. Но ничего хорошего...

## Решение ситуации (1)
1. На все действия с конкретным service, node - ставится MUTEX
2. На уровне кода в TypeScript (JS) NodeJS - используется [async-lock](https://www.npmjs.com/package/async-lock)
3. Ключ для блокировки - название сервиса или название node
4. И только после успешной установки блокировки - NodeJS идет выполнять работу с сервисом

## Ситуация (2)
1. Через API запустили clean-service - service_A
2. Запустился процесс. Процесс займет условно 30 секунд
3. NodeJS - упал, перезапустился, сервер перезапустился
4. Итог: async-lock сбросился
5. Через 5 секунд - стартует CRON для очситки всех сервисов
6. И запускает очситку на service_A
7. Итог: НЕИЗВЕСТНО. Но ничего хорошего...

## Решение ситуации (2)
1. очистка сервиса - это exec команда на docker container
2. Чтобы выполнить docker exec - нужно иметь доступ к docker.sock, где запущен контейнер
3. Мы работаем в условиях - DockerSwarm cluster (10 отдельных серверов)
4. Чтобы выполнить docker-exec на Node_A
   1. Создается service с образом docker-cli на указанной Node
   2. Название сервиса - `CONSTANT+SERVICE_NAME`
   3. Монтирование docker.sock - через volume
   4. Как параметр запуска: docker exec CONTAINER_ID /bin/sh ...
5. Создать более обного сервса с одинаковым названием - НЕЛЬЗЯ (На уровне docker engine)

## Ситуация (3)
1. Через API запустили clean-service - service_A
2. Запустился процесс. Процесс займет условно 30 секунд
3. NodeJS - упал, перезапустился, сервер перезапустился
4. Итог: async-lock сбросился
5. Через 5 секунд снова кинули запрос на очистку сервиса - service_A
6. LOCK - поставился (Так-как он сбросился после перезапуска сервиса)
7. А новый сервис - создать не можем
8. Так как - на уровне docker engine запрещено создавать сервисы с одинаковым названием

## Решение ситуации (3)
1. Перед запуском нового сервиса - для работы с service_A - проверка и удаление
2. Проверить и удалить существующие ВСЕ сервисы для service_A
   1. Все сервисы NOT_EXIST - продолжаем
   2. Некоторые сервисы EXIST && canRemove (isComplete) - завершаем их и продолжаем
   3. Есть хоть один сервис который EXIST && !canRemove - выброс с ошибкой
3. Это значит - что в один момент времени с service_A может происходить только ОДНА операция

## Конкурентность. Mutex-timing
1. Время на блокиррку - 5 секунд
2. Время на выполнение - 10 минут
3. Общее время - 10 минут 10 секунд

## Конкурентность. В чем идея
1. Приходит два запроса через API на update, service=service_a
2. Прежде чем выполнить команду - ставится AsyncLock с ключем: update_service_a
3. Один из запрсоов - сможет поставить LOCK и начать процесс обновления
4. Второй из запросов - вывалится с ошибкой, так как не сможет поставить LOCK

# Основные команды DockerApi
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
9.  docker service ls --filter label="docker-backuper.volume-list-upload" --format json
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
7. Labels. Добавить возможность настрйоки timeout для каждого действия
   1. Если label не указан - timeout из ENV (по умолчанию)
   2. Список labels (SERVICE)
      1. .backup.exec.timeout
      2. .backup.stop.timeout
      3. .backup.volume-list-upload.timeout
      4. .backup.start.timeout
      5. .clean.exec.timeout
   3. Список labels (NODE)
      1. .clean.image.timeout
      2. .clean.builder.timeout
      3. .clean.container.timeout
8. Использовать node-labels
   1. Сколько времени на каждую операцию - для очистки NODE
   2. Какие пользователи, имеют права доступа на очистку этой NODE
   3. Список labels
      1. clean.enable
      2. clean.image.enable
      3. clean.image.timeout
      4. clean.builder.enable
      5. clean.builder.timeout
      6. clean.container.enable
      7. clean.container.timeout
      8. clean.token
9. API. Добавить метод: GET /service/status (info)
   1.  Такие-же права доступа
   2.  Возвращает информацию по сервисы ?? Вместе с логами ??
10. API. В методы: clean/backup - добавить параметр all=true
    1.  Права доступа - такие же, какие везде
    2.  Если указан этот параметр - работа ведется сразу по всем доступным Services (На основе токена и labels=token-list)
11. API. Во все методы - добавить параметр waitRes=true/false
    1.  Если ждать ответ не надо - запускать без await. И сразу отдать res: процесс запущен
12. labels. Добавить для каждого сервиса - сколько живут бэкапы
    1.  Сейчас стоит ХАРДКОД - 5 дней
13. Переделать label (NODE / SERVICE): token -> token-list
    1.  Идея: Чтобы передать сразу список токенов, которые имеют доступ

---

Работа ведётся со списком сервисов - которые были получены вначале! Исполбзовать Map
