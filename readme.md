# SwarmUtils
Один контейнер с утилитами для обслуживания кластера DOCKER-SWARM

# Основные функции
1. clean-node
   1. Удалить все EXITED/STOPPED/COMPLETED containers: docker container prune -f
   2. Удаление ненужных images: docker image prune -f -a
   3. Очистка кэша билдера: docker builder prune -f
   4. ВАЖНО
      1. На данный момент не реализован механизм Labels у Node
      2. Все Node в кластере - будут очищаться
   5. Параметры API запроса
      1. token - обязательный параметр
      2. nodeName - обязательный параметр (super-worker-1)
   6. Запуск: CRON / API
2. backup-service
   1. Резервное копирование
   2. Работает только на service
   3. Загрузка копий на S3 хранилище (Через [offen-backup](https://github.com/offen/docker-volume-backup))
      1. Creds для S3 - общие на весь кластер. Указываеются через ENV переменные `swarm-utils`
   4. Параметры API запроса
      1. token - обязательный параметр
      2. serviceName - обязательный параметр (stack-name_service-name)
   5. Запуск: CRON / API
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
      3. image - обязательный параметр. Полное название. `image-name:tag`
      4. isForce - необязательный параметр. Обновляем FORCE или нет
         1. Если force === true -> task, будет пересоздана. Даже если image - не изменился
   4. Запуск: API

# ENV
| ENV                                                   | Default                      | Описание                                                                        |
| ----------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------- |
| SWARM_UTILS_IS_CRON_BACKUP_SERVICE                    | true                         | Делать бэкап по кроне - бэкап сервисов                                          |
| SWARM_UTILS_IS_CRON_CLEAN_SERVICE                     | true                         | Производить чистку кластера по кроне (SERVICES)                                 |
| SWARM_UTILS_IS_CRON_CLEAN_NODE                        | true                         | Производить чистку кластера по кроне (NODES)                                    |
| SWARM_UTILS_CRON_EXPR                                 | 0 0 3 * * *                  | Интервал работы крон (Cron string). [Пакет](https://www.npmjs.com/package/cron) |
| SWARM_UTILS_ADMIN_TOKEN_LIST                          | -                            | Список из токенов, которае имеют админ права. Пример: tokenA,tokenB,tokenC      |
| SWARM_UTILS_DOCKER_CLI_IMAGE_NAME                     | docker:25.0.5-cli-alpine3.20 | Название docker-cli image, который будет запускаться на каждой `NODE`           |
| SWARM_UTILS_BACKUP_SERVICE_EXEC_SHELL                 | /bin/sh                      | shell - для EXEC комманды в момент BACKUP_SERVICE. `docker exec ... SHELL -c`   |
| SWARM_UTILS_CLEAN_SERVICE_EXEC_SHELL                  | /bin/sh                      | shell - для EXEC комманды в момент CLEAN_SERVICE. `docker exec ... SHELL -c`    |
| SWARM_UTILS_BACKUP_SERVICE_EXEC_TIMEOUT               | 600_000                      | Сколько времени на EXEC команду в момент BACKUP_SERVICE. Значение в MS          |
| SWARM_UTILS_BACKUP_SERVICE_STOP_TIMEOUT               | 30_000                       | Сколько времени на STOP команду в момент BACKUP_SERVICE. Значение в MS          |
| SWARM_UTILS_BACKUP_SERVICE_VOLUME_LIST_UPLOAD_TIMEOUT | 600_000                      | Сколько времени на UPLOAD команду в момент BACKUP_SERVICE. Значение в MS        |
| SWARM_UTILS_BACKUP_SERVICE_START_TIMEOUT              | 300_000                      | Сколько времени на START команду в момент BACKUP_SERVICE. Значение в MS         |
| SWARM_UTILS_CLEAN_SERVICE_EXEC_TIMEOUT                | 60_000                       | Сколько времени на EXEC команду в момент CLEAN_SERVICE. Значение в MS           |
| SWARM_UTILS_UPDATE_SERVICE_TIMEOUT                    | 60_000                       | Сколько времени на UPDATE_SERVICE. Значение в MS                                |
| SWARM_UTILS_CLEAN_NODE_IMAGE_TIMEOUT                  | 60_000                       | Сколько времени на IMAGE PRUNE команду в момент CLEAN_NODE. Значение в MS       |
| SWARM_UTILS_CLEAN_NODE_BUILDER_TIMEOUT                | 60_000                       | Сколько времени на BUILDER PRUNE команду в момент CLEAN_NODE. Значение в MS     |
| SWARM_UTILS_CLEAN_NODE_CONTAINER_TIMEOUT              | 60_000                       | Сколько времени на CONTAINER PRUNE команду в момент CLEAN_NODE. Значение в MS   |
| SWARM_UTILS_PENDING_SERVICE_TIMEOUT                   | 20_000                       | Сколько времени на запуск сервиса. Значение в MS                                |
| SWARM_UTILS_LOCK_TIMEOUT                              | 10_000                       | 10 секунд - сколько времени на уствновку блокировки. Значение в MS              |
| SWARM_UTILS_EXTRA_TIMEOUT                             | 10_000                       | Дополнительное время для блокировки. Задержки сети и ТД. Значение в MS          |
| SWARM_UTILS_S3_URL                                    | s3-api.domain.com            | Доменное имя где находится облако S3                                            |
| SWARM_UTILS_S3_HTTPS                                  | true                         | Использовать HTTPS или нет. Если нет - подключение будет идти через http://     |
| SWARM_UTILS_S3_BUCKET                                 | my-bucket-name               | Название bucket - куда заливать бэкап                                           |
| SWARM_UTILS_S3_ACCESS_KEY                             | ...                          | Ключ для доступа к S3                                                           |
| SWARM_UTILS_S3_SECRET_KEY                             | ...                          | Секрет для доступа к S3                                                         |
| SWARM_UTILS_S3_RETENTION_DAYS                         | 5                            | Сколько времени живет каждый бэкап в S3                                         |
| SWARM_UTILS_REGISTRY_USER                             | ...                          | Имя пользователя, для доступа к docker registry                                 |
| SWARM_UTILS_REGISTRY_PASSWORD                         | ...                          | password/token от registry. token - справами на чтение/запись в registry        |
| SWARM_UTILS_REGISTRY_URL                              | registry.domain.com          | url регистри. Обязательно используется HTTPS                                    |

# Список LABELS
## Для SERVICE
1. swarm-utils.clean
   1. enable=true/false
   2. exec
   3. exec.shell='/bin/bash'
   4. token
2. swarm-utils.backup
   1. enable=true/false
   2. exec
   3. exec.shell='/bin/sh'
   4. stop=true/false
   5. volume-list-upload=volume1,volume2,volume3,...
   6. volume-list-upload.s3.url=s3-api.domain.com
   7. volume-list-upload.s3.https=true/false
   8. volume-list-upload.s3.access-key=...
   9.  volume-list-upload.s3.secret-key=...
   10. volume-list-upload.s3.bucket=...
   11. volume-list-upload.s3.retention-days=8
   12. token
3. swarm-utils.update
   1. enable=true/false
   2. registry.auth=true/false
   3. registry.user=...
   4. registry.password=...
   5. registry.url=...
   6. token

## Для NODE
На данный момент - НЕТ

# В чем идея безопасности
1. Есть кластер - `docker-swarm`
   1. 1 голова
   2. 2 воркера
   3. 2 билдера
   4. 1 хранилище
2. Доступ к серверам по SSH - есть только у Админа (Админов)
   1. То есть - НИКТО из обычных разрабов не имеет доступа к серверам (Напрямую)
3. На голове установлен - `swarm-utils`
   1. Наружу - никаких портом не открывается (По умолчанию)
   2. Если надо - можно. НО - тогда нужно подумать про безопасность
   3. Доступ - возможен только через внутренню `overlay` сеть
4. CI/CD
   1. На сборщиках - установлены раннеры (GitLab runner, Github runner и ТД)
   2. У раннера есть доступ к docker.sock - ЭТО ВАЖНО
   3. Производится сборка - docker build . -t ...
   4. Производится push - на regisdtry. Не важно - что это за registry
   5. Поднимается сервис - alpine-curl (Условно) + attach к overlay сети, которая имеет доступ к swarm-utils
   6. Запрос - на /update с параметрами
   7. Готово
5. Идея токенов - .labels.token
   1. У каждого сервиса, который обслуживается через `swarm-utils` - свой токен доступа
   2. Токен доступа - один на сервис+действие
6. Работаем через GitHub, организация
7.  Работаем через просто GitHub
8.  Работаем через GitLab (self-hosted или нет)

# Проблемы безопасности
## Указать любой image
1. Когда вызывается /update - через параметры можно указать ЛЮБОЙ image
2. Ничего не мешает разработчику - модифицировать CI/CD и указать вредоносный image

## Проблема доступа к двум и более проектов
1. Есть разработчик X
2. У него есть доступ к двум проектам - a, b
3. Следовательно - разработчик знает токены для перезапуска проектов a, b
   1. Для кажого проекта - свой токен (Помним правило)
4. В какой-то момент - принято решение забрать права доступа у разработчика X к провекту a
5. Все - разработчик X больше не может делать коммиты в проект a
   1. Он все еще может делать коммиты в проект b -> тригерить CI/CD в кластере -> имеет доступ к swarm-utils
6. Он знает токен от проекта a -> модифицирует CI/CD проекта b и указывает токен от проекта a
7. Запускает вредоносный image (Что следует из первой уязвимости)

# Права доступа по API - проверяется через "token" (body)
1. Админы
   1. Cписок токенов указан через ENV `SWARM_UTILS_ADMIN_TOKEN_LIST`
   2. Могут делать ВСЕ
   3. Не зависят от `labels.token`
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
1. Время на блокиррку = 10 секунд
2. Время на выполнение = 10 минут
3. Общее время = 10 минут 10 секунд

## Конкурентность. В чем идея
1. Приходит два запроса через API на update, service=service_a
2. Прежде чем выполнить команду - ставится AsyncLock с ключем: update_service_a
3. Один из запрсоов - сможет поставить LOCK и начать процесс обновления
4. Второй из запросов - вывалится с ошибкой, так как не сможет поставить LOCK

# Как рассчитывается timeout (lock, while)
1. async-lock, Timeout состоит из нескольких частей
   1. Время на установку LOCK (пакет: async-lock)
   2. Время на выполнение операции, после установки LOCK
   3. Общее время: установка LOCK + выполнение операции
2. dockerWaitForServiceComplete - Ожидание, пока сервис закончит работу
   1. Для каждой операции есть фиксированный timeout - указан в ENV
   2. SWARM_UTILS_PENDING_SERVICE_TIMEOUT - Время на запуск сервиса. Указано в ENV
   3. Ситуация: Запуск сервиса с неправильным Constraint -> вечный pending
3. Как считается
   1. Время операции = SUM((timeout операции + SWARM_UTILS_PENDING_SERVICE_TIMEOUT) * количество операций) + EXTRA_TIMEOUT
   2. Время суммарно = Время операции + LOCK_TIMEOUT
   3. Количество операций: Например надо сделать clean-service, а у service 4 реплики (4 task, на разных Node) = execTimeout * 4

# swarm-utils.backup.stop
1. Остановка сервиса в момент BACKUP
2. Остановка === docker service scale SERVICE_NAME=0
3. Работает только на сервисы, которые запущены в mode=Replicated

# Как работает registry
1. Кластер подразумевает (Хоть и не всегда) работу с приватным container-registry
   1. Доступ по логин/пароль
   2. Указать конкретный URL
2. Могут быть контейнеры, из разных registry, с разными CREDS
3. Для каждого сервиса, который .update.enable=true -> можно указать через labels данные для registry
   1. auth = true/false
   2. user
   3. password
   4. url
4. Если auth = true (Нужна авторизация, чтобы обновить этот service)
   1. НО - не указаны через labels: user || password || url
   2. -> будут взяты из ENV
5. Если в ENV они не указаны (Хоть одна из переменных - пустая)
   1. Будет ошибка
6. Авторизация требует наличия файла: $HOME/.docker/config.json
   1. Этот файл **НЕ МОНТИРУЕТСЯ** внутрь контейнера при запуске
   2. -> Авторизация будет производиться внутри контейнера, который отвечает за обновление сервиса

# Работа с docker-network, attach, overlay
1. Немного теории
   1. Сервис swarm-utils - работает в контуре docker-swarm
   2. Все контейнеры в кластере docker-swarm - можно связать через overlay сеть
      1. В этом сценарии - контейнеры могут общаться между собой
   3. Если overlay сеть сделть attachable -> к ней можно присоединять обычные контейнеры, запущенные через docker run ...
2. Практика
   1. Создать overlay сеть, отдельную для swarm-utils
   2. docker network create --driver overlay --subnet 10.48.0.0/16 --gateway 10.48.0.1 --attachable swarm-utils-overlay-net
   3. 10.48.0.0/16 и 10.48.0.1 -> можно менять. Тут кому как надо
   4. --attachable -> обязательный параметр

# Сбор результатов с каждого helpService
1. Как известно из документации Docker: 1 service === MANY tasks
2. Введем определения
   1. TASK
   2. HELP_SERVICE
   3. TARGET_SERVICE/TARGET_NODE
3. После завершения команды `dockerWaitForServiceComplete` запускается команда `dockerHelpServiceCompleteInfo`
   1. Это команда собирает логи с каждой `TASK` в указанном SERVICE (по serviceName)
   2. Что собирать логи с `SERVICE/TASK` - нужно запускать `SERVICE` с log-driver=json-file/journald
   3. В данном случае serviceName === `HELP_SERVICE.name`
4. Если хоть одна `TASK` упала с ошибкой -> ВЕСЬ `HELP_SERVICE` упал с ошибкой
   1. За это отвечает параметр isFailed в результате команды `dockerHelpServiceCompleteInfo`
5. На самом верхнем уровне (Где `async-lock`) - возвращается массив из результатов по каждому `HELP_SERVICE`
   1. Например: При clean-node - заускается 3 helpService. Container, image, builder
6. Если хоть один `HELP_SERVICE` упал с ошибкой -> вся процедура по `TARGET_SERVICE/TARGET_NODE` прошла с ошибкой
7. Из метода возвращается массив с резльтатами

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
12. docker service logs SERVICE_NAME/SERVICE_ID/TASK_NAME/TASK_ID
    1.  Проблема: работает только на сервисы с log-driver = json-file/journald
13. docker service remove SERVICE_NAME
14. docker inspect --type
    1.  container|image|node|network|secret|service|volume|task|plugin

# Дополнительные идеи
1. Сделать метод, для переноса docker-volumes между серверами
   1. Нужно перенести Minio с сервера A -> на сервер B
2. В момент update добавить labels
   1. .update.exec-pre
   2. .update.exec-post
3. Добавить node.labels.token
   1. Чтобы можно было по АПИ дергать Clean на Node
4. Labels. Добавить возможность настрйоки timeout для каждого действия
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
5. Использовать node-labels
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
6.  API. Во все методы - добавить параметр waitRes=true/false
    1.  Если ждать ответ не надо - запускать без await. И сразу отдать res: процесс запущен
7.  Labels. Добавить labels для Node
    1.  swarm-utils.clean
        1.  enable=true/false
        2.  exec
        3.  token
    2.  swarm-utils.backup
        1.  enable=true/false
        2.  exec
        3.  volume-list-upload=volume1,volume2,volume3,...
        4.  token
8.  Добавить ENV переменную для маскирования логов
    1.  Скрыкает полный вывод в команде bashExec. Добавляет звездочки
9.  Добавить API методы
    1.  GET /service/status (info)
    2.  получение списка Service
    3.  получение писка Service по labels
    4.  Получение списка Nodes по Labels
10. Уменьшить общее количество логов
    1.  Сейчас для CLEAN одного сервиса - тонна логов....
11. Логи bashExec, логи вывода
    1.  Там могут быть секретные данные - надо придумать, как их скрывать
    2.  Передавать функцию в команду bashExec - для модификации ввода/вывода ?
12. API. Маска на токен
    1.  боди
    2.  bashExec
    3.  На данный момент - токен, с которым идет запрос, светится в логах, без маски
13. Немного переработать структуру файлов
    1.  Связанных с Docker
    2.  Они стали достаточно большими
14. При update - есть проблема с логами
    1.  Хотим собрать логи с сервиса, которы обновляли
    2.  А у сервиса настроен log-drivar как syslog или что-то еще
    3.  Выполнить команду docker service logs XXX -> не получится, работает на сервисы с log-driver=json-file/journald
    4.  А при перезапуске - контейнер упал ...
    5.  В логах команды docker service update будет только: `service update paused: update paused due to failure or early termination of task TASK_ID`
15. Функционал, обновления версий контейнеров
16. Отдельный сервис (Контейнер) - для обновление сервисов. Вызов команды /service/update
17. Отдельный сервис для PUSH собранный образов в registry ?
    1.  Через docker info --format json - можно получить Swarm.NodeID
    2.  Swarm: {"NodeID":"gw97a8q5pfqsfqhncmj987qc2","NodeAddr":"185.224.248.118","LocalNodeState":"active","ControlAvailable":false,"Error":"","RemoteManagers":[{"NodeID":"cxfiamgp1mwxqcjzvbl6jd7ox","Addr":"185.224.248.76:2377"}]}
    3.  Произвести сборку на этой Node
    4.  После - обратиться в swarm-utils и попросить его запушить в registry ?
18. Получить список неиспользуемых volumes
    1.  Получить список node
    2.  на каждой node - получить список volumes
    3.  проверить - что они `unused`
19. Добавить возможность указать адрес docker.sock
    1.  На примере с Traefik + HA-proxy + WorkerNode
    2.  Можно поднять HA-proxy на ManagerNode и открыть доступ к docker.sock через TCP
