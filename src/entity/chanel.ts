import bigInt from "big-integer";
import { Entity, Column, PrimaryColumn } from "typeorm"

@Entity()
export class Channel {
    @PrimaryColumn({type: 'bigint'})
    ChanelID: string = "0";

    @Column()
    Name: string = "";

    @Column()
    IsDead: boolean = false;

    @Column()
    Exported: boolean = false;

    @Column({ type: 'timestamptz', nullable: true })
    DieDate?: Date;

    public GetID(): bigInt.BigInteger {
        return bigInt(this.ChanelID);
    }
    public SetID(value: bigInt.BigInteger) {
        this.ChanelID = value.toString();
    }
}