import TelegramBot from 'node-telegram-bot-api';
import { AppDataSource, ChannelRepository, ProxyRepo, UserRepository } from './db-service';
import { Status, WatchdogService } from './watchdog-service';
import { User } from '../entity/user';
import { readFileSync, writeFileSync } from 'fs';
import { Channel } from '../entity/chanel';

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN || "", { polling: true });

interface CustomKB {
    [identifier: string]: TelegramBot.KeyboardButton[][];
}
export class BotSession {
    public ChatID: number | undefined;
}
export module BotService {
    export const CmdSetDefault: TelegramBot.BotCommand[] = [
        { command: "/auth", description: "Вход" },
        { command: "/start", description: "Старт" }
    ];
    export const CmdSetAuth: TelegramBot.BotCommand[] = [
        { command: "/menu", description: "Меню" },
        { command: "/logout", description: "Выход" },
        { command: "/export", description: "Экспортировать последние умершие каналы" },
        { command: "/exportall", description: "Экспортировать все умершие каналы" },
        { command: "/cleardead", description: "Удалить все умершие каналы из проверки" },
        { command: "/add", description: "Добавить каналы в отслеживание" },
        { command: "/addproxy", description: "Добавить прокси (user:pass@ip:port списком)" },
        { command: "/proxy", description: "Выводит кол-во прокси" },
        { command: "/clearproxy", description: "Очистить все прокси" },
        { command: "/check", description: "Ручной запуск проверки" },
        { command: "/wipe", description: "Удаление всех каналов" },
    ];

    export const Keyboards: CustomKB = {
        "Confirmation": [
            [{text: "Да"}, {text: "Нет"}]
        ],
        "ClientControl": [
            [{text: "Выход"}, {text: "Статус"}]
        ]
    };

    export const ExportKeyboardConfig: TelegramBot.SendMessageOptions = {
        reply_markup: {
            keyboard: [
                [ { text: "⬇️ Экспорт" } ]
            ],
            one_time_keyboard: true,
            remove_keyboard: true
        }
    };

    export const SendMessage = async (chatId: TelegramBot.ChatId, text: string, options?: TelegramBot.SendMessageOptions | undefined) => bot.sendMessage(chatId, text, options);

    export async function IsAuth(ID: number | undefined) {
        if (ID == undefined) return false;
        try {
            return await UserRepository.existsBy({UserID: ID});
        } catch (err) {
            console.log("[ERROR] BotService:IsAuth");
            console.log(err);
            return false;
        }
    }
    export async function AddAuth(ChatID: number | undefined, UserID: number | undefined) {
        if (UserID == undefined || ChatID == undefined) return false;
        try {
            let usr = new User();
            usr.ChatID = ChatID;
            usr.UserID = UserID;

            return (await UserRepository.save(usr)).UserID == UserID;
        } catch (err) {
            console.log("[ERROR] BotService:AddAuth");
            console.log(err);
            return false;
        }
    }
    export async function RemoveAuth(ID: number | undefined) {
        if (ID == undefined) return false;
        try {
            return ((await UserRepository.delete({UserID: ID})).affected || 0) > 0;
        } catch (err) {
            console.log("[ERROR] BotService:RemoveAuth");
            console.log(err);
            return false;
        }
    }

    export async function SendMenu(ChatID: number | undefined, UserID: number | undefined) { 
        if (ChatID == undefined || UserID == undefined) return false;

        try {
            const Info = await WatchdogService.getChannelsInfo();
            var stat = `Проверка: ${WatchdogService.checkStatus == Status.Active ? `Активно (${(WatchdogService.stats.percent * 100).toFixed(1)}%)` : "Простой"}`;
            bot.sendMessage(ChatID, `Channel Checker\n\nВсего: ${Info.total}\nЖивые: ${Info.alive}\nМертвые: ${Info.dead}\n${stat}`); // \n\nСтатус: ${WatchdogService.checkStatus == Status.Active ? `В процессе ()` : "🔴"}\n${stat}
            return true;
        } catch (err) {
            console.log("[ERROR] BotService:SendMenu");
            console.log(err);
            return false;
        }
    }   
    export function SendUnauthorized(ChatID: number | undefined, UserID: number | undefined) { 
        if (ChatID == undefined || UserID == undefined) return false;

        try {
            bot.sendMessage(ChatID, `Вы не авторизованы!\nИспользуйте /auth [pass]`);
            return true;
        } catch (err) {
            console.log("[ERROR] BotService:SendMenu");
            console.log(err);
            return false;
        }
    }
    export function SendAlreadyAuth(ChatID: number | undefined, UserID: number | undefined) { 
        if (ChatID == undefined || UserID == undefined) return false;
        try {
            bot.sendMessage(ChatID, `Вы уже авторизованы!`);
            return SendMenu(ChatID, UserID);
        } catch (err) {
            console.log("[ERROR] BotService:SendAlreadyAuth");
            console.log(err);
            return false;
        }
    }
    export function SendBadPassword(ChatID: number | undefined, UserID: number | undefined) { 
        if (ChatID == undefined || UserID == undefined) return false;

        try {
            bot.sendMessage(ChatID, `Неверный пароль!`);
            return true;
        } catch (err) {
            console.log("[ERROR] BotService:SendBadPassword");
            console.log(err);
            return false;
        }
    }
    export function SendSuccessAuth(ChatID: number | undefined, UserID: number | undefined) { 
        if (ChatID == undefined || UserID == undefined) return false;

        try {
            bot.sendMessage(ChatID, `Успешная авторизация!`);
            return SendMenu(ChatID, UserID);
        } catch (err) {
            console.log("[ERROR] BotService:SendSuccessAuth");
            console.log(err);
            return false;
        }
    }
    export function SendSuccessLogout(ChatID: number | undefined, UserID: number | undefined) { 
        if (ChatID == undefined || UserID == undefined) return false;

        try {
            bot.sendMessage(ChatID, `Вы успешно деавторизованны`);
            return true;
        } catch (err) {
            console.log("[ERROR] BotService:SendSuccessLogout");
            console.log(err);
            return false;
        }
    }
    export function SendBadLogout(ChatID: number | undefined, UserID: number | undefined) { 
        if (ChatID == undefined || UserID == undefined) return false;

        try {
            bot.sendMessage(ChatID, `Ошибка деавторизации!`);
            return true;
        } catch (err) {
            console.log("[ERROR] BotService:SendBadLogout");
            console.log(err);
            return false;
        }
    }
    export function SendBadAuth(ChatID: number | undefined, UserID: number | undefined) { 
        if (ChatID == undefined || UserID == undefined) return false;

        try {
            bot.sendMessage(ChatID, `Ошибка авторизации!`);
            return true;
        } catch (err) {
            console.log("[ERROR] BotService:SendBadAuth");
            console.log(err);
            return false;
        }
    }

    export function SendBadFormat(ChatID: number | undefined, UserID: number | undefined) { 
        if (ChatID == undefined || UserID == undefined) return false;

        try {
            bot.sendMessage(ChatID, `Неверный формат!`);
            return true;
        } catch (err) {
            console.log("[ERROR] BotService:SendBadFormat");
            console.log(err);
            return false;
        }
    }

    export async function Broadcast(text: string, options?: TelegramBot.SendMessageOptions | undefined) {
        text = text.trim();
        if (text == "") return false;

        try {
            var users = await AppDataSource.getRepository(User).find();
            let errOccur = false;
            for (const usr of users) {
                try {
                    bot.sendMessage(usr.ChatID, text, options);
                } catch (err) {
                    errOccur = true || errOccur;
                    console.log(`[ERROR] BotService:Broadcast:send-${usr.UserID}+id`);
                    console.log(err);
                }
            }

            return !errOccur;
        } catch (err) {
            console.log("[ERROR] BotService:Broadcast");
            console.log(err);
            return false;
        }
    }
    
    export function SetAuthCommandSet(ChatID: number | undefined, UserID: number | undefined) {
        if (ChatID == undefined || UserID == undefined) return false;

        try {
            bot.setMyCommands(CmdSetAuth);
            return true;
        } catch (err) {
            console.log("[ERROR] BotService:SendBadLogout");
            console.log(err);
            return false;
        }
    }
    export function SetDefaultCommandSet(ChatID: number | undefined, UserID: number | undefined) {
        if (ChatID == undefined || UserID == undefined) return false;

        try {
            bot.setMyCommands(CmdSetDefault);
            return true;
        } catch (err) {
            console.log("[ERROR] BotService:SendBadLogout");
            console.log(err);
            return false;
        }
    }

    export const BotEnv: BotSession[] = [];
}

bot.on('document', async (msg) => {
    const UserID = msg.from?.id;
    const ChatID = msg.chat.id;
    const AuthOK = await BotService.IsAuth(UserID);

    if (!AuthOK) {
        BotService.SendUnauthorized(ChatID, UserID);
        BotService.SetDefaultCommandSet(ChatID, UserID);
        return;
    }

    if (msg.document == undefined) return;

    var path = `./docs/`;
    bot.downloadFile(msg.document.file_id, path).then((x) => {
        var content = readFileSync(x, 'utf8');
        var names = content.split('[').map((x) => x.split('/').pop()?.replace('\r', '').replace('\n', ''));
        var chls: string[] = [];
        names.forEach((x, i, a) => {
            if (x == undefined) return;
            let usrn = x.toLowerCase().trim();
            if (usrn == "") return;
            chls.push(x.toLowerCase().trim())
        });

        if (chls.length <= 0) {
            bot.sendMessage(ChatID, "❗️ Не удалось распознать ни одного названия");
            return;
        }
    
        WatchdogService.AddChannels(chls)
        bot.sendMessage(ChatID, `✅ Добавлено ${chls.length} каналов в отслеживание`);
    });
});

bot.onText(/\/start/, async (msg, match) => {
    const UserID = msg.from?.id;
    const ChatID = msg.chat.id;
    const AuthOK = await BotService.IsAuth(UserID);

    if (AuthOK) {
        BotService.SendMenu(ChatID, UserID);
        BotService.SetAuthCommandSet(ChatID, UserID);
    } else {
        BotService.SendUnauthorized(ChatID, UserID);
        BotService.SetDefaultCommandSet(ChatID, UserID);
    }
});

bot.onText(/\/menu/, async (msg, match) => {
    const UserID = msg.from?.id;
    const ChatID = msg.chat.id;
    const AuthOK = await BotService.IsAuth(UserID);

    if (AuthOK) {
        BotService.SendMenu(ChatID, UserID);
        BotService.SetAuthCommandSet(ChatID, UserID);
    } else {
        BotService.SendUnauthorized(ChatID, UserID);
        BotService.SetDefaultCommandSet(ChatID, UserID);
    }
});

bot.onText(/\/auth/, async (msg, match) => {
    const UserID = msg.from?.id;
    const ChatID = msg.chat.id;
    const AuthOK = await BotService.IsAuth(UserID);

    if (AuthOK) {
        BotService.SendAlreadyAuth(ChatID, UserID);
    } else {
        const InputPass = msg.text?.trim().split(' ').pop();
        if (InputPass === process.env.BOT_AUTH) {
            const AuthOK = await BotService.AddAuth(ChatID, UserID);
            if (AuthOK) {
                BotService.SendSuccessAuth(ChatID, UserID);
                BotService.SetAuthCommandSet(ChatID, UserID);
            } else {
                BotService.SendBadAuth(ChatID, UserID);
            }
        } else {
            BotService.SendBadPassword(ChatID, UserID);
            BotService.SetDefaultCommandSet(ChatID, UserID);
        }
    }
});

bot.onText(/\/logout/, async (msg, match) => {
    const UserID = msg.from?.id;
    const ChatID = msg.chat.id;
    const AuthOK = await BotService.IsAuth(UserID);

    if (AuthOK) {
        const UnAuthOK = await BotService.RemoveAuth(UserID);
        if (UnAuthOK) {
            BotService.SendSuccessLogout(ChatID, UserID);
            BotService.SetDefaultCommandSet(ChatID, UserID);
        } else {
            BotService.SendBadLogout(ChatID, UserID);
        }
    } else {
        BotService.SendUnauthorized(ChatID, UserID);
        BotService.SetDefaultCommandSet(ChatID, UserID);
    }
});

bot.onText(/\/cleardead/, async (msg, match) => {
    const UserID = msg.from?.id;
    const ChatID = msg.chat.id;
    const AuthOK = await BotService.IsAuth(UserID);

    if (AuthOK) {
        var ret = await WatchdogService.ClearDead();
        bot.sendMessage(ChatID, `🗑 Удаление\nЗатронуто ${ret || 0} мертвых каналов`);
    } else {
        BotService.SendUnauthorized(ChatID, UserID);
        BotService.SetDefaultCommandSet(ChatID, UserID);
    }
});

bot.onText(/\/export$/, async (msg, match) => {
    const UserID = msg.from?.id;
    const ChatID = msg.chat.id;
    const AuthOK = await BotService.IsAuth(UserID);

    if (AuthOK) {
        var dead = await WatchdogService.GetDeadUnexportChannels();
        if (dead.length <= 0) {
            bot.sendMessage(ChatID, 'Нечего экспортировать');
            return;
        }

        var str = "";
        dead.forEach((x, i) => {str += `[${i}] \t@${x.username}\n`});
        writeFileSync('./result.txt', str, 'utf8');
        await bot.sendDocument(ChatID, './result.txt')

        ChannelRepository.createQueryBuilder()
            .update(Channel)
            .set({ Exported: true })
            .where("Exported = :Exported", { Exported: false })
            .execute();
    } else {
        BotService.SendUnauthorized(ChatID, UserID);
        BotService.SetDefaultCommandSet(ChatID, UserID);
    }
});

bot.onText(/\/exportall$/, async (msg, match) => {
    const UserID = msg.from?.id;
    const ChatID = msg.chat.id;
    const AuthOK = await BotService.IsAuth(UserID);

    if (AuthOK) {
        var dead = await WatchdogService.GetDeadChannels();
        if (dead.length <= 0) {
            bot.sendMessage(ChatID, 'Нечего экспортировать');
            return;
        }

        var str = "";
        dead.forEach((x, i) => {str += `[${i}] @${x.username}\n`});
        writeFileSync('./result.txt', str, 'utf8');
        await bot.sendDocument(ChatID, './result.txt')

        ChannelRepository.createQueryBuilder()
            .update(Channel)
            .set({ Exported: true })
            .where("Exported = :Exported", { Exported: false })
            .execute();
    } else {
        BotService.SendUnauthorized(ChatID, UserID);
        BotService.SetDefaultCommandSet(ChatID, UserID);
    }
});

bot.onText(/\/add\\s*/, async (msg, match) => {
    const UserID = msg.from?.id;
    const ChatID = msg.chat.id;
    const AuthOK = await BotService.IsAuth(UserID);

    if (!AuthOK) {
        BotService.SendUnauthorized(ChatID, UserID);
        BotService.SetDefaultCommandSet(ChatID, UserID);
        return;
    }

    const input = ((msg.text?.trim().split(' ').pop() + " ").replaceAll('@', '').replaceAll(';', ' ').replaceAll(':', ' ').split(' ')) || [];
    const chls: string[] = [];
    input.forEach((x, i, a) => {
        let usrn = x.toLowerCase().trim();
        if (usrn == "") return;
        chls.push(x.toLowerCase().trim())
    });

    if (chls.length <= 0) {
        bot.sendMessage(ChatID, "❗️ Не удалось распознать ни одного названия");
        return;
    }

    WatchdogService.AddChannels(chls)
    bot.sendMessage(ChatID, `✅ Добавлено ${chls.length} каналов в отслеживание`);
});

bot.onText(/\/check/, async (msg, match) => {
    const UserID = msg.from?.id;
    const ChatID = msg.chat.id;
    const AuthOK = await BotService.IsAuth(UserID);

    if (!AuthOK) {
        BotService.SendUnauthorized(ChatID, UserID);
        BotService.SetDefaultCommandSet(ChatID, UserID);
        return;
    }

    WatchdogService.StartCheck();
    bot.sendMessage(ChatID, `✅ Проверка запущена!\nОтслеживается ${await ChannelRepository.countBy({ IsDead: false })} каналов`);
});

bot.onText(/\/wipe/, async (msg, match) => {
    const UserID = msg.from?.id;
    const ChatID = msg.chat.id;
    const AuthOK = await BotService.IsAuth(UserID);

    if (!AuthOK) {
        BotService.SendUnauthorized(ChatID, UserID);
        BotService.SetDefaultCommandSet(ChatID, UserID);
        return;
    }

    await ChannelRepository.clear();
    bot.sendMessage(ChatID, `♻️ Полная очистка`);
});

bot.onText(/\/addproxy/, async (msg, match) => {
    const UserID = msg.from?.id;
    const ChatID = msg.chat.id;
    const AuthOK = await BotService.IsAuth(UserID);

    if (!AuthOK) {
        BotService.SendUnauthorized(ChatID, UserID);
        BotService.SetDefaultCommandSet(ChatID, UserID);
        return;
    }

    var added = 0;
    try {
        var text = msg.text?.split(' ')[1];
        var inps = text?.split('\n');
        if (inps) {
            var prox = await WatchdogService.parseProxy(inps);
            for (let p of prox) { (await ProxyRepo.save(p)); added++; }
        }
    } catch {}

    bot.sendMessage(ChatID, `Добавлено ${added} прокси`);
});

bot.onText(/\/proxy/, async (msg, match) => {
    const UserID = msg.from?.id;
    const ChatID = msg.chat.id;
    const AuthOK = await BotService.IsAuth(UserID);

    if (!AuthOK) {
        BotService.SendUnauthorized(ChatID, UserID);
        BotService.SetDefaultCommandSet(ChatID, UserID);
        return;
    }

    var proxy = await ProxyRepo.count();

    bot.sendMessage(ChatID, `Всего ${proxy} прокси`);
});

bot.onText(/\/clearproxy/, async (msg, match) => {
    const UserID = msg.from?.id;
    const ChatID = msg.chat.id;
    const AuthOK = await BotService.IsAuth(UserID);

    if (!AuthOK) {
        BotService.SendUnauthorized(ChatID, UserID);
        BotService.SetDefaultCommandSet(ChatID, UserID);
        return;
    }

    await ProxyRepo.clear();

    bot.sendMessage(ChatID, `Все прокси очищенны`);
});