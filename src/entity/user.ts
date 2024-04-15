import { Entity, PrimaryColumn, Column } from "typeorm"

@Entity()
export class User {
    @PrimaryColumn({type: 'bigint'})
    public UserID: number = -1;

    @Column({type: 'bigint'})
    public ChatID: number = -1;
}