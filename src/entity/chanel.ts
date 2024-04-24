import bigInt from "big-integer";
import { Entity, Column, PrimaryColumn } from "typeorm"

@Entity()
export class Channel {
    @PrimaryColumn()
    username: string = "";

    @Column()
    IsDead: boolean = false;

    @Column()
    Exported: boolean = false;

    @Column({ type: 'timestamptz', nullable: true })
    DieDate?: Date;
}