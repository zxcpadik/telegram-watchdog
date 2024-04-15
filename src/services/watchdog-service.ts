import { StoreSession } from "telegram/sessions";
import { ChannelRepository } from "./db-service";
import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { BotService } from "./bot-service";
import EventEmitter from "events";
import { writeFileSync, readFileSync } from "fs";
import { Channel } from "entity/chanel";

export module WatchdogService {
  const stringSession = new StringSession(readFileSync("./session", 'utf-8'));
  const client = new TelegramClient(stringSession, Number(process.env.TG_API_ID) || 0, process.env.TG_API_HASH || "", {
    connectionRetries: 5
  });
  const events = new EventEmitter();
  export var cChatID: number = -1;

  export async function GetTotalChannelsCount() {
    try {
      return await ChannelRepository.count();
    } catch (err) {
      console.log("[ERROR] WatchdogService:GetTotalChannelsCount");
      console.log(err);
      return -1;
    }
  }
  export async function GetAliveChannelsCount() {
    try {
      return await ChannelRepository.countBy({IsDead: false});
    } catch (err) {
      console.log("[ERROR] WatchdogService:GetAliveChannelsCount");
      console.log(err);
      return -1;
    }
  }
  export async function GetDeadChannelsCount() {
    try {
      return await ChannelRepository.countBy({IsDead: true});
    } catch (err) {
      console.log("[ERROR] WatchdogService:GetDeadChannelsCount");
      console.log(err);
      return -1;
    }
  }
  export async function ClearAll() {
    try {
      return (await ChannelRepository.delete({})).affected;
    } catch (err) {
      console.log("[ERROR] WatchdogService:ClearAll");
      console.log(err);
      return -1;
    }
  }
  export async function ClearDead() {
    try {
      return (await ChannelRepository.delete({IsDead: true})).affected;
    } catch (err) {
      console.log("[ERROR] WatchdogService:ClearDead");
      console.log(err);
      return undefined;
    }
  }
  export async function ClearAlive() {
    try {
      return (await ChannelRepository.delete({IsDead: false})).affected;
    } catch (err) {
      console.log("[ERROR] WatchdogService:ClearAlive");
      console.log(err);
      return -1;
    }
  }

  export async function GetAllChannels() {
    try {
      return await ChannelRepository.find();
    } catch (err) {
      console.log("[ERROR] WatchdogService:GetAllChannels");
      console.log(err);
      return [];
    }
  }
  export async function GetAliveChannels() {
    try {
      return await ChannelRepository.findBy({IsDead: false});
    } catch (err) {
      console.log("[ERROR] WatchdogService:GetAliveChannels");
      console.log(err);
      return [];
    }
  }
  export async function GetDeadChannels() {
    try {
      return await ChannelRepository.findBy({IsDead: true});
    } catch (err) {
      console.log("[ERROR] WatchdogService:GetDeadChannels");
      console.log(err);
      return [];
    }
  }
  export async function GetDeadUnexportChannels() {
    try {
      return await ChannelRepository.findBy({IsDead: true, Exported: false});
    } catch (err) {
      console.log("[ERROR] WatchdogService:GetDeadChannels");
      console.log(err);
      return [];
    }
  }

  export async function GetUnexportedChannels() {
    try {
      return await ChannelRepository.findBy({IsDead: true, Exported: false});
    } catch (err) {
      console.log("[ERROR] WatchdogService:GetUnexportedChannels");
      console.log(err);
      return [];
    }
  }

  export function PassNumber(number: string) {
    return events.emit("phone", number);
  }
  export function PassPassword(password: string) {
    return events.emit("password", password);
  }
  export function PassCode(code: string) {
    return events.emit("code", code.split("").reverse().join(""));
  }

  export function RequestNumber() {
    BotService.Broadcast("Необходима авторизация клиента!\n/phone [номер]");
    return new Promise<string>((resolve) => {
      events.once("phone", (phone: string) => {
        return resolve(phone);
      });
    });
  }
  export function RequestPassword() {
    if (cChatID != -1) {
      BotService.SendMessage(cChatID, "Введите пароль\n/pass");
    }
    return new Promise<string>((resolve) => {
      events.once("password", (phone: string) => {
        return resolve(phone);
      });
    });
  }
  export function RequestCode() {
    return new Promise<string>((resolve) => {
      console.log("BREAK0");
      if (cChatID != -1) {
        BotService.SendMessage(cChatID, "Введите код\n/code");
      }
      console.log("BREAK1");
      events.once("code", (phone: string) => {
        console.log(`\"${phone}\"`);
        return resolve(phone);
      });
    });
  }

  export async function InitClient() {
    await client.start({
      phoneNumber: () => RequestNumber(),
      password: () => RequestPassword(),
      phoneCode: () => RequestCode(),
      onError: (err) => {
        BotService.Broadcast("Ошибка клиента!\nПроверь лог");
        console.log("[ERROR] WatchdogService:Client -> onError");
        console.log(err);
      }
    });

    var s = client.session.save() as unknown as string;
    if (s != "") {
      writeFileSync("./session", client.session.save() as unknown as string, 'utf8');
      WatchdogLoop();
      setInterval(WatchdogLoop, Number(process.env.CHECK_INTERVAL) * 1000);
      if (cChatID != -1) BotService.SendMessage(cChatID, "Успешная авторизация!");
    } else {
      if (cChatID != -1) BotService.SendMessage(cChatID, "Ошибка авторизации!");
    }
    cChatID = -1;
  }

  async function WatchdogLoop() {
    try {
      var channels = (await client.getDialogs()).filter((v) => v.isChannel == true);
      var checking = await GetAliveChannels();
      var markedIDs: Channel[] = [];

      checking.forEach((check) => {
        let ind = channels.findIndex((x) => { return (x.entity as Api.Channel).id == check.GetID() });
        if (ind == -1) {
          ChannelRepository.update({ ChanelID: check.ChanelID }, { IsDead: true, DieDate: new Date() });
          markedIDs.push(check);
        } else {
          if (channels[ind] instanceof Api.ChannelForbidden) {
            ChannelRepository.update({ ChanelID: check.ChanelID }, { IsDead: true, DieDate: new Date() });
            markedIDs.push(check);
          }
        }
      });

      /*if (markedIDs.length > 0 && markedIDs.length <= 10) {
        var str = "";
        markedIDs.forEach((x) => {str += `\n@${x.Name} - ID-${x.ChanelID}`});

        BotService.Broadcast(`⚠️ Отчет\nОтлетело ${markedIDs.length} каналов\n${str}`, BotService.ExportKeyboardConfig);
      } else if (markedIDs.length > 10) {
        BotService.Broadcast(`⚠️ Отчет\nОтлетело ${markedIDs.length} каналов`, BotService.ExportKeyboardConfig);
      }*/
      if (markedIDs.length > 0) {
        BotService.Broadcast(`⚠️ Отчет\nОтлетело ${markedIDs.length} каналов\nИспользуйте /export`);
      }
    } catch (err) {
      BotService.Broadcast("Ошибка сервиса!\nПроверь лог");
      console.log("[ERROR] WatchdogService:WatchdogLoop");
      console.log(err);
    }
  }

  export function JoinChannel(username: string) {
    return client.invoke(
      new Api.channels.JoinChannel({
        channel: username,
      })
    );
  }
  export function ChannelIDChannel(username: string) {
    return client.invoke(
      new Api.channels.GetChannels({
        id: [username],
      })
    );
  }

  export function GetClientStatus() {
    return client.isUserAuthorized();
  }
}