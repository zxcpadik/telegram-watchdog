import TelegramBot from 'node-telegram-bot-api';
import { AppDataSource, ChannelRepository, UserRepository } from './db-service';
import { WatchdogService } from './watchdog-service';
import { User } from '../entity/user';
import { writeFileSync } from 'fs';
import { Channel } from '../entity/chanel';
import { Api } from 'telegram';

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
        //{ command: "/authclient", description: "Авторизация клиента" },
        //{ command: "/clientlogout", description: "Выход из аккаунта клиента" }
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
            const Info = {total: await WatchdogService.GetTotalChannelsCount(), live: await WatchdogService.GetAliveChannelsCount(), dead: await WatchdogService.GetDeadChannelsCount(), authOK: await WatchdogService.GetClientStatus()};
            bot.sendMessage(ChatID, `ChannelDetector\n\nВсего: ${Info.total}\nЖивые: ${Info.live}\nМертвые: ${Info.dead}\n\nСтатус: ${Info.authOK ? "🟢" : "🔴"}`);
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

bot.onText(/\/phone/, async (msg, match) => {
    const UserID = msg.from?.id;
    const ChatID = msg.chat.id;
    const AuthOK = await BotService.IsAuth(UserID);

    if (AuthOK) {
        WatchdogService.cChatID = ChatID;
        var InputPhone = msg.text?.trim().split(' ').pop();
        if (InputPhone == undefined) {
            BotService.SendBadFormat(ChatID, UserID);
        } else WatchdogService.PassNumber(InputPhone);
    } else {
        BotService.SendUnauthorized(ChatID, UserID);
        BotService.SetDefaultCommandSet(ChatID, UserID);
    }
});

bot.onText(/\/code/, async (msg, match) => {
    const UserID = msg.from?.id;
    const ChatID = msg.chat.id;
    const AuthOK = await BotService.IsAuth(UserID);

    if (AuthOK) {
        WatchdogService.cChatID = ChatID;
        var InputCode = msg.text?.trim().split(' ').pop();
        if (InputCode == undefined) {
            BotService.SendBadFormat(ChatID, UserID);
        } else WatchdogService.PassCode(InputCode);
    } else {
        BotService.SendUnauthorized(ChatID, UserID);
        BotService.SetDefaultCommandSet(ChatID, UserID);
    }
});

bot.onText(/\/pass/, async (msg, match) => {
    const UserID = msg.from?.id;
    const ChatID = msg.chat.id;
    const AuthOK = await BotService.IsAuth(UserID);

    if (AuthOK) {
        WatchdogService.cChatID = ChatID;
        var InputPass = msg.text?.trim().split(' ').pop();
        if (InputPass == undefined) {
            BotService.SendBadFormat(ChatID, UserID);
        } else WatchdogService.PassPassword(InputPass);
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
        dead.forEach((x, i) => {str += `[${i}] ID: ${x.ChanelID} \t@${x.Name}\n`});
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
        dead.forEach((x, i) => {str += `[${i}] ID: ${x.ChanelID} \t@${x.Name}\n`});
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

bot.onText(/\/join/, async (msg, match) => {
    const UserID = msg.from?.id;
    const ChatID = msg.chat.id;
    const AuthOK = await BotService.IsAuth(UserID);

    if (AuthOK) {
        var inputUsernames = (msg.text?.trim().split(' ').pop()?.replaceAll('@', '').replaceAll(' ', '').replaceAll(';', ',').replaceAll(':', ',').split(',')) || [];
        if (inputUsernames.length <= 0) {
            BotService.SendBadFormat(ChatID, UserID);
            return;
        }

        let ok = 0;
        for (let i = 0; i < inputUsernames.length; i++) {
            try {
                const resultJoin = await WatchdogService.JoinChannel(inputUsernames[i]);
                const resultID = (await WatchdogService.ChannelIDChannel(inputUsernames[i])).chats[0].id;
                
                var ch = new Channel();
                ch.SetID(resultID);
                ch.Name = inputUsernames[i];
                ChannelRepository.save(ch);

                ok++;
            } catch {}
        }

        bot.sendMessage(ChatID, `Вход в каналы:\n${ok}/${inputUsernames.length}`);
    } else {
        BotService.SendUnauthorized(ChatID, UserID);
        BotService.SetDefaultCommandSet(ChatID, UserID);
    }
});
