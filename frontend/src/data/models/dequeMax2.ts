export class DequeMax2{
    deque : Array<string>

    constructor(){
        this.deque= new Array()
    }

    add(landmark : string){
        if(this.selected(landmark) || landmark == null){
            return;
        }
        if(this.deque.length == 2){
            this.deque.shift()
        }
        this.deque.push(landmark)
    }
    
    remove(landmark: string){
        let index : number = this.deque.indexOf(landmark)
        this.deque.splice(index, 1)
    }

    selected(landmark: string){
        return this.deque.indexOf(landmark) >= 0
    }

    fullSelected(){
        return this.deque.length == 2
    }
}