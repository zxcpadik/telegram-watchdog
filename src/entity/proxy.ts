import { Entity, PrimaryColumn, Column, PrimaryGeneratedColumn } from "typeorm"

@Entity()
export class Proxy {
    @PrimaryGeneratedColumn()
    public id: number = 0;

    @Column()
    public username: string = "";

    @Column()
    public password: string = "";

    @Column()
    public ip: string = "";

    @Column()
    public port: number = -1;
}