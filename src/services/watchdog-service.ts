import { StoreSession } from "telegram/sessions";
import { ChannelRepository } from "./db-service";
import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { BotService } from "./bot-service";
import EventEmitter from "events";
import { writeFileSync, readFileSync } from "fs";
import { Channel } from "entity/chanel";

export enum Status {
  Idle = "Idle",
  Active = "Active"
}

export async function Delay(ms: number) {
  return new Promise((r) => setTimeout(() => { r(0) }, ms));
}

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
    return events.emit("code", code);
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
      setInterval(StartCheck, Number(process.env.CHECK_INTERVAL) * 1000);
      if (cChatID != -1) BotService.SendMessage(cChatID, "Успешная авторизация!");
    } else {
      if (cChatID != -1) BotService.SendMessage(cChatID, "Ошибка авторизации!");
    }
    cChatID = -1;
  }

  export function AddChannels(username: string[]) {
    for (let x of username) {
      ChannelRepository.save({ username: x, IsDead: false, Exported: false })
    }
  }
  export async function TestChannel(username: string): Promise<boolean> {
    try {
      var ch = await client.getEntity(username);
      if (ch instanceof Api.ChannelForbidden) return false;
      return true;
    } catch (err) { return false; }
  }

  export var checkStatus: Status = Status.Idle;
  export var checkProgress = 0;

  export async function StartCheck() {
    if (checkStatus != Status.Idle) return;
    checkStatus = Status.Active;

    var usernames = await ChannelRepository.findBy({ IsDead: false });
    var dead = [];
    if (usernames.length <= 0) {
      checkStatus = Status.Idle;
      return;
    } 
    for (let i = 0; i < usernames.length; i++) {
      await Delay(7000);
      if (!(await TestChannel(usernames[i].username))) dead.push(usernames[i]);
      checkProgress = i / usernames.length;
    }

    dead.forEach(async (x) => await ChannelRepository.update({ username: x.username }, { IsDead: true }))
    BotService.Broadcast(`👁‍🗨 Проверка завершена\nЖивые: ${await ChannelRepository.countBy({ IsDead: false })}\nМертвые: ${await ChannelRepository.countBy({ IsDead: true })}\nУмерло: ${dead.length}`);

    checkStatus = Status.Idle;
  }
  export function GetClientStatus() {
    return client.isUserAuthorized();
  }
}

