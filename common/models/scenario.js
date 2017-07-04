module.exports = function(Scenario) {

  Scenario.getNewLeases = function(id, cb) {
    
    // for each expiration 
    // create a new lease
    // after waiting period
    // console.log("get new leases: " + Date.now())
    
    new_leases = []
    
    Scenario.findById(id, {},function(err, scenario) { 
      
      if (err) {
        cb(err)
        return
      }
      
      if (scenario == null) {
        cb(err)
        return
      }
            
      // get the deal, then the buildings
      Scenario.app.models.Deal.findById(scenario.dealId, 
        { include:  "buildings"  }, 
           function(err,deal) {
             
             if (err) {
               cb(err)
               return
             }
             
             var all_leases = []
             deal.buildings({ include: "leases" },function(err,buildings) {
                 
                if (err) {
                  cb(err)
                  return
                }
                
                buildings.forEach(function(b,bIndex) {
                                     
                  buildings[bIndex].leases({},function(err,leases) {
                                          
                    leases.forEach(function(l,lIndex) {
                         all_leases.push(leases[lIndex]) 
                    })
                    if (bIndex == buildings.length -1) {
                      
                      new_leases = []

                      expirations = get_lease_expirations(leases, scenario)
                      expirations.forEach(function(e) {
                        l = create_new_lease(e,scenario)   
                        new_leases.push(l)
                      })
            
                      new_expirations = get_lease_expirations(new_leases,scenario)
                      new_expirations.forEach(function(ne) {
                        l = create_new_lease(ne,scenario,2)
                        new_leases.push(l) 
                      })  
            
                      //return new_leases   
                      cb(null,new_leases);
                      
                      return
                    }
                    
                  })  
                 
                })
               
             })
             
          }) 
        
    });
    
  }

  Scenario.remoteMethod('getNewLeases', {
        accepts: {arg: 'id', type: 'string'},
        returns: {arg: 'greeting', type: 'string'}
  });


  get_lease_expirations = function(leases, scenario) {
    
    // loop all leases, find any that expire in range
    // without extension, specify the space and date
    
    expirations = []
    leases.forEach(function(l) {
      count = 0

      p = get_lease_expiration(l.space,scenario)
      if (p != undefined) {
        //console.log(p)
        v = {}
        v.space_id = l.space.id
        v.sqft = l.space.sqft
        v.pro_rata = l.space.pro_rata
        v.available = p.end
        v.old_tenant = l.tenant
        pieces = p.end.split("/")
        v.month = pieces[0] + "/" + pieces[1]
        expirations.push(v)
      }
  
    })

    //console.log(JSON.stringify(expirations))
    return expirations
  } 
  

  create_new_lease = function(e, scenario, cycle=1) {
  
      //console.log("exp=" + JSON.stringify(e))
      l = {}
      l.tenant = e.space_id + "(" + cycle + ")"
      l.space = {}
      l.space.id = e.space_id
      l.space.tenant = l.tenant
      l.space.pro_rata = e.pro_rata
      l.space.sqft = e.sqft
      l.space.periods = []
      l.space.extensions = []
    
      //pieces = e.available.split("/")
      //start = new Date(parseInt(pieces[2]),parseInt(pieces[0]),parseInt(pieces[1]))
      start = new Date(e.available)
      start.setMonth(start.getMonth() + parseInt(scenario.down_months) -1)
      l.space['lease-start'] = start.getMonth() + "/" + start.getDate() + "/" + start.getFullYear()
    
      end = new Date(start.valueOf())
      end.setFullYear(end.getFullYear() + parseInt(scenario.new_lease.years))
      end.setDate(end.getDate() -1)
    
      l.space['lease-end'] = end.getMonth() + "/" + end.getDate() + "/" + end.getFullYear()
    
      for (z=0; z< parseInt(scenario.new_lease.years); z++) {
        p = {}
        //p.start_date = start
        m = start.getMonth() + 1
        p.start =  m + "/" + start.getDate() + "/" + start.getFullYear()

        end = new Date(start.valueOf())
        end.setFullYear(end.getFullYear() + 1)
        end.setDate(end.getDate() -1)
        m = end.getMonth() + 1
        p.end =  m + "/" + end.getDate() + "/" + end.getFullYear()
  
        diff = start.getFullYear() - 2017
  
        p.base_rent = calc_increase(parseFloat(scenario.new_lease.base_rent),diff,parseFloat(scenario.new_lease.increases))
        //console.log("diff=" + diff + " increase=" + increase + " new_rent=" + p.base_rent)
        p.re_taxes = scenario.new_lease.re_taxes
        p.cam = scenario.new_lease.cam
        p.mgmt_fee = scenario.new_lease.mgmt

        l.space.periods.push(p)
        start = new Date(start.valueOf())
        start.setFullYear(start.getFullYear() + 1)
      }
    

      l.space.ti = scenario.new_lease.ti_psf * e.sqft
      l.space.lc = Math.round(scenario.new_lease.commision * e.sqft * scenario.new_lease.base_rent * scenario.new_lease.years)
      //console.log("newl=" + JSON.stringify(l))
    return l
  }

  get_lease_expiration = function(space,scenario) {
    var expiring_period = undefined
    if (space == undefined) {
      return undefined
    }
      
    latest_period = undefined
    if (space.periods != undefined) {
      // find latest period, 
      // then see if it ends in this month
      latest_end = new Date(2000,01,01)
    
      space.periods.forEach(function(p) {
                
        pieces = p.end.split("/")
        end = new Date(pieces[2],pieces[0],pieces[1])
        //console.log("year="+year + " end=" + end.getFullYear() )
        if (end > latest_end) {
          latest_end = end
          latest_period = p
        }
      })
          
      if (space.extensions != undefined) {
        scenario.extensions.forEach(function(se) {  
          if (se.space_id == space.id) {
            //console.log(se)
        
            space.extensions.forEach(function(e) {
              if (se.extension_id == e.id) {
                //console.log(e)
                pieces = e.end.split("/")
                end = new Date(pieces[2],pieces[0],pieces[1])
                //console.log("year="+year + " end=" + end.getFullYear() )
                if (end > latest_end) {
                  latest_end = end
                  latest_period = e
                }
              }
            })
          }
        })
    
      }
    
    
    }
    
    return latest_period
  }

  calc_increase = function(base,years,rate) {
    x = base
    for (i=0; i<=years; i++) {
      //console.log(i+ " " + x)
      x = x + x*rate
    }
    return x
  }

};
